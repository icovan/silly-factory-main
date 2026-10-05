using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    internal static string Home;
    internal static string LoaderDir;
    internal static Process Server;
    static Mutex instanceMutex;
    static StreamWriter serverLog;
    const string PortUrl = "http://127.0.0.1:3210/";

    [STAThread]
    static void Main(string[] args)
    {
        if (HasArg(args, "--uninstall"))
        {
            Uninstall();
            return;
        }
        if (HasArg(args, "--extract-only"))
        {
            AllocConsole();
            Console.WriteLine(PrepareApp(null));
            return;
        }

        ExtractRuntime();
        AppDomain.CurrentDomain.AssemblyResolve += new ResolveEventHandler(ResolveAssembly);
        if (!TakeInstance()) return;
        StartUi();
    }

    static void StartUi()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        SetupForm setup = new SetupForm();
        Application.Run(setup);
        if (!setup.Ready) return;
        MainForm.PrepareWebView();
        Application.Run(new MainForm());
    }

    [DllImport("kernel32.dll")]
    static extern bool AllocConsole();

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    static extern bool IsWindow(IntPtr hWnd);

    static bool HasArg(string[] args, string name)
    {
        for (int i = 0; i < args.Length; i++)
        {
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    static void ExtractRuntime()
    {
        Home = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SillyFactory");
        LoaderDir = Path.Combine(Home, "webview2loader");
        Directory.CreateDirectory(LoaderDir);
        WriteResource("WV.WinForms", Path.Combine(LoaderDir, "Microsoft.Web.WebView2.WinForms.dll"));
        WriteResource("WV.Core", Path.Combine(LoaderDir, "Microsoft.Web.WebView2.Core.dll"));
        WriteResource("WV.Loader", Path.Combine(LoaderDir, "WebView2Loader.dll"));
    }

    static void WriteResource(string name, string dest)
    {
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        {
            if (input == null) throw new InvalidOperationException("Missing " + name);
            using (FileStream output = File.Create(dest)) input.CopyTo(output);
        }
    }

    static Assembly ResolveAssembly(object sender, ResolveEventArgs e)
    {
        string file = Path.Combine(LoaderDir, new AssemblyName(e.Name).Name + ".dll");
        if (!File.Exists(file)) return null;
        return Assembly.LoadFrom(file);
    }

    static bool TakeInstance()
    {
        bool created = false;
        try
        {
            instanceMutex = new Mutex(true, @"Local\SillyFactory.SingleInstance", out created);
        }
        catch (AbandonedMutexException)
        {
            created = true;
        }
        if (created) return true;
        FocusRunning();
        return false;
    }

    internal static void RememberWindow(IntPtr handle)
    {
        try
        {
            File.WriteAllText(Path.Combine(Home, "window.hwnd"), handle.ToInt64().ToString());
        }
        catch (Exception)
        {
        }
    }

    static void FocusRunning()
    {
        try
        {
            string path = Path.Combine(Home, "window.hwnd");
            if (!File.Exists(path)) return;
            long value;
            if (!long.TryParse(File.ReadAllText(path).Trim(), out value)) return;
            IntPtr handle = new IntPtr(value);
            if (!IsWindow(handle)) return;
            ShowWindow(handle, 9);
            SetForegroundWindow(handle);
        }
        catch (Exception)
        {
        }
    }

    internal static string PrepareApp(Action<string> status)
    {
        if (status != null) status("prepare");
        Stream raw = Assembly.GetExecutingAssembly().GetManifestResourceStream("Payload");
        if (raw == null) throw new InvalidOperationException("This program does not contain the app.");
        byte[] bytes;
        using (raw)
        using (MemoryStream copy = new MemoryStream())
        {
            raw.CopyTo(copy);
            bytes = copy.ToArray();
        }

        string hash;
        using (SHA256 sha = SHA256.Create())
        {
            hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "");
        }

        string appDir = Path.Combine(HomeDir(), "app");
        string stampPath = Path.Combine(HomeDir(), "payload.stamp");
        string previous = File.Exists(stampPath) ? File.ReadAllText(stampPath).Trim() : "";
        if (previous == hash) return appDir;

        Directory.CreateDirectory(HomeDir());
        Extract(bytes, appDir);
        string built = Path.Combine(appDir, ".next");
        if (Directory.Exists(built)) Directory.Delete(built, true);
        File.WriteAllText(stampPath, hash);
        return appDir;
    }

    static string HomeDir()
    {
        if (!string.IsNullOrEmpty(Home)) return Home;
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SillyFactory");
    }

    static void Extract(byte[] bytes, string appDir)
    {
        Directory.CreateDirectory(appDir);
        string root = Path.GetFullPath(appDir).TrimEnd('\\') + "\\";
        using (MemoryStream stream = new MemoryStream(bytes))
        using (ZipArchive zip = new ZipArchive(stream, ZipArchiveMode.Read))
        {
            foreach (ZipArchiveEntry entry in zip.Entries)
            {
                if (string.IsNullOrEmpty(entry.Name)) continue;
                string relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                string dest = Path.GetFullPath(Path.Combine(appDir, relative));
                if (!dest.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue;
                Directory.CreateDirectory(Path.GetDirectoryName(dest));
                entry.ExtractToFile(dest, true);
            }
        }
    }

    internal static int RunSetup(string appDir, Action<string> onLine, Process[] started)
    {
        string script = Path.Combine(appDir, "desktop", "setup-and-run.ps1");
        if (!File.Exists(script)) throw new FileNotFoundException("Setup script is missing.", script);
        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = "powershell.exe";
        start.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"";
        start.WorkingDirectory = appDir;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;
        Process process = Process.Start(start);
        started[0] = process;
        process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
        {
            if (e.Data != null && onLine != null) onLine(e.Data);
        };
        process.ErrorDataReceived += delegate { };
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        process.WaitForExit();
        return process.ExitCode;
    }

    internal static void EnsureWindowRuntime(Action<string> status)
    {
        if (WindowRuntimeInstalled()) return;
        if (status != null) status("window");
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
        string setup = Path.Combine(Path.GetTempPath(), "MicrosoftEdgeWebview2Setup.exe");
        using (WebClient client = new WebClient())
        {
            client.DownloadFile("https://go.microsoft.com/fwlink/p/?LinkId=2124703", setup);
        }
        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = setup;
        start.Arguments = "/silent /install";
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        Process process = Process.Start(start);
        process.WaitForExit();
        if (process.ExitCode != 0 && process.ExitCode != 3010) throw new InvalidOperationException("WebView2 setup failed.");
    }

    static bool WindowRuntimeInstalled()
    {
        return RuntimeIn(Registry.LocalMachine) || RuntimeIn(Registry.CurrentUser);
    }

    static bool RuntimeIn(RegistryKey root)
    {
        string[] paths = new string[]
        {
            @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
            @"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
        };
        for (int i = 0; i < paths.Length; i++)
        {
            using (RegistryKey key = root.OpenSubKey(paths[i]))
            {
                if (key == null) continue;
                object pv = key.GetValue("pv");
                if (pv == null) continue;
                string version = pv.ToString();
                if (version.Length > 0 && version != "0.0.0.0") return true;
            }
        }
        return false;
    }

    internal static void StartServer(string appDir)
    {
        StopServer();
        string node = Path.Combine(HomeDir(), "node", "node.exe");
        string nextBin = Path.Combine(appDir, "node_modules", "next", "dist", "bin", "next");
        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = node;
        start.Arguments = "\"" + nextBin + "\" start -p 3210";
        start.WorkingDirectory = appDir;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.RedirectStandardOutput = true;
        start.RedirectStandardError = true;
        start.EnvironmentVariables["PATH"] = Path.Combine(HomeDir(), "node") + ";" + start.EnvironmentVariables["PATH"];
        Server = Process.Start(start);
        File.WriteAllText(Path.Combine(HomeDir(), "server.pid"), Server.Id.ToString());
        serverLog = new StreamWriter(Path.Combine(HomeDir(), "server.log"), false);
        serverLog.AutoFlush = true;
        Server.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
        {
            if (e.Data != null) serverLog.WriteLine(e.Data);
        };
        Server.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
        {
            if (e.Data != null) serverLog.WriteLine(e.Data);
        };
        Server.BeginOutputReadLine();
        Server.BeginErrorReadLine();
    }

    internal static bool WaitForPage()
    {
        for (int i = 0; i < 90; i++)
        {
            if (PageUp()) return true;
            Thread.Sleep(1000);
        }
        return false;
    }

    static bool PageUp()
    {
        try
        {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(PortUrl);
            req.Timeout = 2000;
            req.Proxy = null;
            req.Method = "GET";
            using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
            {
                return (int)res.StatusCode < 500;
            }
        }
        catch (Exception)
        {
            return false;
        }
    }

    internal static void StopServer()
    {
        if (Server != null)
        {
            try
            {
                if (!Server.HasExited) KillPid(Server.Id);
            }
            catch (Exception)
            {
            }
            Server = null;
        }
        string pidPath = Path.Combine(HomeDir(), "server.pid");
        if (!File.Exists(pidPath)) return;
        try
        {
            int pid;
            if (int.TryParse(File.ReadAllText(pidPath).Trim(), out pid)) KillPid(pid);
            File.Delete(pidPath);
        }
        catch (Exception)
        {
        }
    }

    static void KillPid(int pid)
    {
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "taskkill.exe";
            psi.Arguments = "/F /T /PID " + pid.ToString();
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            Process killer = Process.Start(psi);
            if (killer != null) killer.WaitForExit();
        }
        catch (Exception)
        {
        }
    }

    internal static void UseAppIcon(Form form)
    {
        try
        {
            Icon icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            if (icon != null) form.Icon = icon;
        }
        catch (Exception)
        {
        }
    }

    static void Uninstall()
    {
        string installDir = Path.GetDirectoryName(Application.ExecutablePath);
        bool installedCopy = string.Equals(Path.GetFileName(installDir), "Silly Factory", StringComparison.OrdinalIgnoreCase);
        if (!installedCopy)
        {
            MessageBox.Show(
                "\u8bf7\u5728\u7cfb\u7edf\u7684\u5e94\u7528\u5217\u8868\u91cc\u5378\u8f7d\u3002",
                "Silly Factory",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }
        DialogResult answer = MessageBox.Show(
            "\u5378\u8f7d Silly Factory\uff1f\r\n\u4e0b\u8f7d\u7684\u8fd0\u884c\u73af\u5883\u4e5f\u4f1a\u4e00\u8d77\u5220\u6389\u3002",
            "Silly Factory",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (answer != DialogResult.Yes) return;

        foreach (Process process in Process.GetProcessesByName("silly-factory"))
        {
            if (process.Id != Process.GetCurrentProcess().Id) KillPid(process.Id);
        }
        StopServer();
        string link = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Silly Factory.lnk");
        if (File.Exists(link)) File.Delete(link);
        try
        {
            Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\SillyFactory", false);
        }
        catch (Exception)
        {
        }
        string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SillyFactory");
        try
        {
            if (Directory.Exists(data)) Directory.Delete(data, true);
        }
        catch (Exception)
        {
        }
        ProcessStartInfo cleanup = new ProcessStartInfo();
        cleanup.FileName = "cmd.exe";
        cleanup.Arguments = "/c ping 127.0.0.1 -n 3 >nul & rmdir /s /q \"" + installDir + "\"";
        cleanup.CreateNoWindow = true;
        cleanup.UseShellExecute = false;
        Process.Start(cleanup);
    }
}

sealed class SetupForm : Form
{
    readonly Label detail;
    readonly ProgressBar bar;
    readonly Button closeButton;
    readonly Process[] setupProcess = new Process[1];
    internal bool Ready;

    public SetupForm()
    {
        Text = "Silly Factory";
        Program.UseAppIcon(this);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(440, 188);
        BackColor = Color.FromArgb(247, 247, 243);
        Font = MakeFont(10.5f, FontStyle.Regular);

        Label title = new Label();
        title.Text = "Silly Factory";
        title.Font = MakeFont(18f, FontStyle.Bold);
        title.ForeColor = Color.FromArgb(17, 17, 17);
        title.Bounds = new Rectangle(28, 22, 384, 36);

        Label hint = new Label();
        hint.Text = "\u7b2c\u4e00\u6b21\u4f7f\u7528\u9700\u8981\u4e0b\u8f7d\u8fd0\u884c\u73af\u5883\u3002";
        hint.ForeColor = Color.FromArgb(80, 80, 80);
        hint.Bounds = new Rectangle(28, 64, 384, 24);

        detail = new Label();
        detail.Text = StatusText("prepare");
        detail.ForeColor = Color.FromArgb(17, 17, 17);
        detail.Bounds = new Rectangle(28, 92, 384, 24);

        bar = new ProgressBar();
        bar.Style = ProgressBarStyle.Marquee;
        bar.MarqueeAnimationSpeed = 25;
        bar.Bounds = new Rectangle(28, 132, 384, 16);

        closeButton = new Button();
        closeButton.Text = "\u5173\u95ed";
        closeButton.Bounds = new Rectangle(332, 128, 80, 28);
        closeButton.Visible = false;
        closeButton.Click += delegate { Close(); };

        Controls.Add(title);
        Controls.Add(hint);
        Controls.Add(detail);
        Controls.Add(bar);
        Controls.Add(closeButton);
        Shown += delegate { ThreadPool.QueueUserWorkItem(delegate { Work(); }); };
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Program.RememberWindow(Handle);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        Process process = setupProcess[0];
        if (!Ready && process != null && !process.HasExited)
        {
            try { process.Kill(); }
            catch (Exception) { }
        }
        if (!Ready) Program.StopServer();
        base.OnFormClosing(e);
    }

    void Work()
    {
        try
        {
            string appDir = Program.PrepareApp(delegate(string statusCode) { SetStatus(statusCode); });
            int exitCode = Program.RunSetup(appDir, delegate(string line)
            {
                if (line.StartsWith("STATUS ")) SetStatus(line.Substring(7).Trim());
            }, setupProcess);
            if (exitCode != 0)
            {
                Fail("\u51c6\u5907\u6ca1\u6709\u5b8c\u6210\u3002\u53ef\u4ee5\u518d\u53cc\u51fb\u8bd5\u4e00\u6b21\u3002");
                return;
            }
            Program.EnsureWindowRuntime(delegate(string statusCode) { SetStatus(statusCode); });
            SetStatus("open");
            Program.StartServer(appDir);
            if (!Program.WaitForPage())
            {
                Program.StopServer();
                Fail("\u51c6\u5907\u6ca1\u6709\u5b8c\u6210\u3002\u53ef\u4ee5\u518d\u53cc\u51fb\u8bd5\u4e00\u6b21\u3002");
                return;
            }
            BeginInvoke(new Action(delegate
            {
                Ready = true;
                Close();
            }));
        }
        catch (Exception)
        {
            Program.StopServer();
            Fail("\u51c6\u5907\u6ca1\u6709\u5b8c\u6210\u3002\u53ef\u4ee5\u518d\u53cc\u51fb\u8bd5\u4e00\u6b21\u3002");
        }
    }

    void SetStatus(string code)
    {
        string text = StatusText(code);
        if (IsDisposed) return;
        BeginInvoke(new Action(delegate
        {
            if (!IsDisposed) detail.Text = text;
        }));
    }

    void Fail(string message)
    {
        if (IsDisposed) return;
        BeginInvoke(new Action(delegate
        {
            if (IsDisposed) return;
            bar.Visible = false;
            closeButton.Visible = true;
            detail.Text = message;
        }));
    }

    static string StatusText(string code)
    {
        if (code == "node") return "\u6b63\u5728\u4e0b\u8f7d Node.js";
        if (code == "deps") return "\u6b63\u5728\u5b89\u88c5\u4f9d\u8d56\uff0c\u7b2c\u4e00\u6b21\u4f1a\u4e45\u4e00\u70b9";
        if (code == "browser") return "\u6b63\u5728\u4e0b\u8f7d\u6e32\u67d3\u6d4f\u89c8\u5668";
        if (code == "build") return "\u6b63\u5728\u6784\u5efa\u672c\u5730\u9875\u9762";
        if (code == "window") return "\u6b63\u5728\u5b89\u88c5\u7a97\u53e3\u7ec4\u4ef6";
        if (code == "open") return "\u6b63\u5728\u6253\u5f00";
        return "\u6b63\u5728\u51c6\u5907\u8fd0\u884c\u73af\u5883";
    }

    static Font MakeFont(float size, FontStyle style)
    {
        try
        {
            return new Font("Microsoft YaHei UI", size, style, GraphicsUnit.Point);
        }
        catch (Exception)
        {
            return new Font(FontFamily.GenericSansSerif, size, style, GraphicsUnit.Point);
        }
    }
}

sealed class MainForm : Form
{
    readonly WebView2 webView;

    internal static void PrepareWebView()
    {
        CoreWebView2Environment.SetLoaderDllFolderPath(Program.LoaderDir);
    }

    public MainForm()
    {
        Text = "Silly Factory";
        Program.UseAppIcon(this);
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1120, 800);
        MinimumSize = new Size(800, 600);
        BackColor = Color.FromArgb(247, 247, 243);
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        Controls.Add(webView);
        Shown += delegate { OpenPage(); };
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Program.RememberWindow(Handle);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        Program.StopServer();
        base.OnFormClosing(e);
    }

    void OpenPage()
    {
        string profile = Path.Combine(Program.Home, "webview-profile");
        Directory.CreateDirectory(profile);
        CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions("--autoplay-policy=no-user-gesture-required");
        CoreWebView2Environment.CreateAsync(null, profile, options).ContinueWith(delegate(Task<CoreWebView2Environment> task)
        {
            BeginInvoke(new Action(delegate
            {
                try
                {
                    CoreWebView2Environment env = task.Result;
                    webView.EnsureCoreWebView2Async(env).ContinueWith(delegate(Task done)
                    {
                        BeginInvoke(new Action(delegate
                        {
                            if (done.IsFaulted)
                            {
                                ShowPageError();
                                return;
                            }
                            webView.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args)
                            {
                                args.Handled = true;
                                if (string.IsNullOrEmpty(args.Uri)) return;
                                if (args.Uri.IndexOf("127.0.0.1") >= 0 || args.Uri.IndexOf("localhost") >= 0)
                                    webView.CoreWebView2.Navigate(args.Uri);
                                else
                                    Process.Start(args.Uri);
                            };
                            webView.CoreWebView2.DocumentTitleChanged += delegate
                            {
                                BeginInvoke(new Action(delegate
                                {
                                    if (!IsDisposed) Text = webView.CoreWebView2.DocumentTitle;
                                }));
                            };
                            webView.Source = new Uri("http://127.0.0.1:3210/");
                        }));
                    });
                }
                catch (Exception)
                {
                    ShowPageError();
                }
            }));
        });
    }

    void ShowPageError()
    {
        Label label = new Label();
        label.Text = "\u9875\u9762\u6ca1\u6709\u6253\u5f00\u3002\u53ef\u4ee5\u518d\u53cc\u51fb\u8bd5\u4e00\u6b21\u3002";
        label.Dock = DockStyle.Fill;
        label.TextAlign = ContentAlignment.MiddleCenter;
        Controls.Add(label);
        label.BringToFront();
    }
}
