using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class Installer
{
    static string installedExe;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallForm());
    }

    internal static void Install()
    {
        foreach (Process process in Process.GetProcessesByName("silly-factory"))
        {
            throw new InvalidOperationException("\u8bf7\u5148\u9000\u51fa\u6b63\u5728\u8fd0\u884c\u7684 Silly Factory\u3002");
        }

        string dir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "Silly Factory");
        Directory.CreateDirectory(dir);
        installedExe = Path.Combine(dir, "silly-factory.exe");
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("AppExe"))
        {
            if (input == null) throw new InvalidOperationException("Missing app.");
            using (FileStream output = File.Create(installedExe)) input.CopyTo(output);
        }

        string link = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Silly Factory.lnk");
        CreateShortcut(link, installedExe, dir);

        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\SillyFactory"))
        {
            key.SetValue("DisplayName", "Silly Factory");
            key.SetValue("Publisher", "Silly Factory");
            key.SetValue("DisplayVersion", "0.1.0");
            key.SetValue("InstallLocation", dir);
            key.SetValue("DisplayIcon", installedExe);
            key.SetValue("UninstallString", "\"" + installedExe + "\" --uninstall");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord);
            key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }

    internal static void Launch()
    {
        Process.Start(installedExe);
    }

    static void CreateShortcut(string linkPath, string target, string workDir)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(shellType);
        object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { linkPath });
        Type shortcutType = shortcut.GetType();
        shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { target });
        shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workDir });
        shortcutType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "Silly Factory" });
        shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
    }
}

sealed class InstallForm : Form
{
    readonly Label detail;
    readonly Button installButton;
    readonly ProgressBar bar;

    public InstallForm()
    {
        Text = "Silly Factory";
        UseAppIcon(this);
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

        detail = new Label();
        detail.Text = "\u5b89\u88c5\u5230\u8fd9\u53f0\u7535\u8111\u3002\u7b2c\u4e00\u6b21\u6253\u5f00\u4f1a\u4e0b\u8f7d\u8fd0\u884c\u73af\u5883\u3002";
        detail.ForeColor = Color.FromArgb(17, 17, 17);
        detail.Bounds = new Rectangle(28, 68, 384, 48);

        bar = new ProgressBar();
        bar.Style = ProgressBarStyle.Marquee;
        bar.MarqueeAnimationSpeed = 25;
        bar.Bounds = new Rectangle(28, 132, 384, 16);
        bar.Visible = false;

        installButton = new Button();
        installButton.Text = "\u5b89\u88c5";
        installButton.Bounds = new Rectangle(332, 128, 80, 28);
        installButton.Click += delegate { BeginInstall(); };

        Controls.Add(title);
        Controls.Add(detail);
        Controls.Add(bar);
        Controls.Add(installButton);
        AcceptButton = installButton;
    }

    void BeginInstall()
    {
        installButton.Enabled = false;
        installButton.Visible = false;
        bar.Visible = true;
        detail.Text = "\u6b63\u5728\u5b89\u88c5";
        ThreadPool.QueueUserWorkItem(delegate
        {
            try
            {
                Installer.Install();
                BeginInvoke(new Action(delegate
                {
                    Installer.Launch();
                    Close();
                }));
            }
            catch (Exception ex)
            {
                BeginInvoke(new Action(delegate
                {
                    bar.Visible = false;
                    installButton.Visible = true;
                    installButton.Enabled = true;
                    detail.Text = ex.Message;
                }));
            }
        });
    }

    static void UseAppIcon(Form form)
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
