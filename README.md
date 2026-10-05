# 智障工厂™

主题进去，大约 15 秒的竖屏视频出来。密钥填在页面顶部的箭头里，只留在你的浏览器。

## 自己电脑上开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。

## 推到 GitHub

1. 打开 https://github.com/new ，建一个空仓库。不要勾 README。
2. 在项目文件夹里执行（地址换成你的）：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/silly-factory.git
git push -u origin main
```

弹出登录就用浏览器登 GitHub。不要上传 `.env`。

以后改完再推：

```bash
git add .
git commit -m "写一句改了什么"
git push
```

## 服务器 Docker

服务器先装好 Docker。在项目文件夹里：

```bash
docker build -t silly-factory .
docker run -d --name silly-factory -p 3000:3000 silly-factory
```

浏览器打开 `http://服务器IP:3000` 。密钥仍由每个用户自己在页面里填。

更新时：

```bash
docker build -t silly-factory .
docker rm -f silly-factory
docker run -d --name silly-factory -p 3000:3000 silly-factory
```

## 打包成 PC 版

图标放在 `desktop/icon/app.ico`。一个文件里要有 16、32、48、256 四张正方形图。放好后在项目文件夹里运行：

```bash
desktop\pack.cmd
```

得到两个小文件，上传到 GitHub Releases 或直接发给用户。用户不用下载源码。

- `dist\silly-factory.exe`：免安装，双击即用
- `dist\silly-factory-setup.exe`：安装版，装好后出现在开始菜单，可以卸载

第一次打开才会下载 Node 和渲染浏览器。完成后用软件自己的窗口打开页面。
