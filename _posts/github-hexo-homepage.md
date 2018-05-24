---
title: github+hexo搭建个人主页
date: 2018-05-20 15:41:09
tags:
 - github
 - hexo
categories: devtool
thumbnail: /images/acupt-home-20180520.png
---

以前也尝试过搭建个人主页，前端+后端+服务器+域名，等这些都弄过一遍后，发现系统设计的太挫没有使用的欲望（还不如在开源中国写博客，页面美观还有人点赞）。某天突然明确了我的需求，一个酷炫的主面，一个可以看自己文章的页面，这些文章的资源最好具备通用性（比如.md），即可。

hexo，快速、简洁且高效的博客框架。hexo快速搭建博客（不写代码），基本无缝接入自己的md文档，配合github，服务器和域名也有了。

+ macOS Sierra
+ github
+ git
+ nodejs
+ hexo

## github个人主页创建

[官方教程](https://pages.github.com/)

### 新建仓库

我的github用户名是acupt，新建仓库，名为 acupt.github.io， git地址为 git@github.com:acupt/acupt.github.io.git

github给你的个人主页地址为 https://acupt.github.io

### 修改主页

访问主页地址将展示根目录下的index.html，如果没有的话展示README.md，也没有？告辞！

这时候可以在index.html里面写主页代码了，不想写的继续往下。

## hexo搭建个人主页

### 安装hexo

准备工作，请自行安装

+ nodejs
+ git

开始安装hexo，新建一个文件夹并进入它

```
npm install hexo-cli -g
hexo init
npm install

```

### 启动hexo

```
hexo g # 生成文件，同 hexo generate
hexo s # 启动服务，同 hexo server
```

启动成功后在浏览器访问 http://localhost:4000

### 修改主题

如果默认模板就能满足，此步骤可以跳过，但不找个酷炫的模板还怎么zhuangbility。

#### 下载主题
先找到你想象中的滑板鞋（ [官方模板库](https://hexo.io/themes/) ），克隆模板到hexo的themes目录下。

```
# 我好不容易找到的酷炫模板
git clone https://github.com/miccall/hexo-theme-Mic_Theme.git
```

但这个项目名不太友好，克隆成功后需要把文件夹重命名为模板名。

```
mv hexo-theme-Mic_Theme miccall
```

#### 主题模板配置

编辑hexo主目录下的_config.yml，修改theme参数为新的主题名miccall

```
# Extensions
## Plugins: https://hexo.io/plugins/
## Themes: https://hexo.io/themes/
#theme: yilia
theme: miccall
```

修改模板的配置文件，在模板文件夹内也有个_config.yml，和hexo主目录下的_config.yml负责的东西不一样，hexo的配置管通用属性，模板的配置管个性参数，模板的项目首页一般都有配置教程。

模板可能有些地方不符合自己的需求，如果没法配置的话，除了给作者提issue，还可以自己改模板代码（反正代码在本地，可以为所欲为），比如我把这个模板的group（团队）布局用来展示自己的作品，那我就不需要QQ微信微博，只要个链接就行了，看文档没有相关参数隐藏，去代码里搜索了下，注释掉了那几行代码。

#### 重启服务

如果之前启动着，Ctrl+C关闭，后台运行的就kill掉。

```
hexo clean # 清除缓存，会删除主目录下的public目录和数据库数据
hexo g
hexo s
```

## hexo发布个人主页到github

编辑hexo主目录下的_config.yml，修改deploy配置

```
# Deployment
## Docs: https://hexo.io/docs/deployment.html
deploy:
    type: git
    repo: git@github.com:acupt/acupt.github.io.git
    branch: master
```

此配置表示用部署到git上，不过需要再安装一个插件。

```
npm install hexo-deployer-git --save
```

发布

```
hexo g
hexo d
```

访问自己的github个人页面（如 https://acupt.github.io/ )，查看效果。

感谢miccall@github提供的酷炫模板，https://github.com/miccall/hexo-theme-Mic_Theme 
