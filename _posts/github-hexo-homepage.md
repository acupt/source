---
title: github+hexo搭建个人主页
date: 2018-05-20 15:41:09
tags:
 - github
 - hexo
categories: 实践笔记
thumbnail: /images/acupt-home-20180520.png
---

> 作为技术人员，谁不曾想过有一个属于自己的网站。但因为种种原因（没时间、没技术、没钱...），往往只是想想。现在，一套完整的解决方案来帮助彷徨的你实现梦想~

在下以前也尝试过搭建个人主页，前端+后端+服务器+域名，等这些都弄过一遍后，发现系统设计的太挫没有使用的欲望，也没有写博客的欲望。某天突然醒悟了，别搞那些花里胡哨的，好好找个现成的工具能搭建自己的网站就行，我都能想到，别人肯定早做出来了。

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

### 写文章

主目录下执行命令可新建一个md文件，也可以自己新建到source/_posts目录下

```
hexo new "文件名" #新建文章
hexo new page "页面名" #新建页面   

# 常用简写
hexo n == hexo new
hexo g == hexo generate
hexo s == hexo server
hexo d == hexo deploy
```

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

## 技术性改进

虽然这个主题很酷炫，但不可能每一点都如我所愿，如果主题作者未提供可配置选项，就需要对模板源代码做些改动。

先去主题项目的github主页fork一份到自己的github，再clone到本地。

### links布局配置可选

此主题的团队页面布局我很喜欢，但我并没有小伙伴想贴上去，那就做成作品展示页面好了。但是这个布局设计之初是为了展示人，所以有QQ、微信等信息配置，但我只想要一个‘链接’属性，其它的显示出来有点碍事。

IDE打开本地代码，全局搜索，就用属性名做关键词，果断在一个page-links.ejs文件中发现。

```
<ul class="social">
    <li><a href="<%= site.data.links[i].link%>" class="fa fa-link"></a></li>
    <li><a href="<%= site.data.links[i].qq%>" class="fa fa-qq"></a></li>
    <li><a href="<%= site.data.links[i].wachat%>" class="fa fa-wechat"></a></li>
    <li><a href="<%= site.data.links[i].weibo%>" class="fa fa-weibo"></a></li>
</ul>
```

网上查一下语法，加个if判断。

```
<ul class="social">
    <% if (site.data.links[i].link != null) { %>
    <li><a href="<%= site.data.links[i].link%>" class="fa fa-link"></a></li>
    <%}%>
    <% if (site.data.links[i].qq != null) { %>
    <li><a href="<%= site.data.links[i].qq%>" class="fa fa-qq"></a></li>
    <%}%>
    <% if (site.data.links[i].wachat != null) { %>
    <li><a href="<%= site.data.links[i].wachat%>" class="fa fa-wechat"></a></li>
    <%}%>
    <% if (site.data.links[i].weibo != null) { %>
    <li><a href="<%= site.data.links[i].weibo%>" class="fa fa-weibo"></a></li>
    <%}%>
</ul>
```

妥了

![1](https://user-images.githubusercontent.com/10628338/40361024-879fcbf2-5dfa-11e8-922e-f2a26b4c3441.png)

![1](https://user-images.githubusercontent.com/10628338/40361011-7dbd6eb4-5dfa-11e8-945b-66b7676f2b57.png)

![1](https://user-images.githubusercontent.com/10628338/40361045-94a62dd2-5dfa-11e8-863a-dbf3a07b8bb0.png)

### https站内访问http资源受限

部署到github后第二天发现我酷炫的作品展示页面不再酷炫了，样式有点诡异，打开调试界面

![1](https://user-images.githubusercontent.com/10628338/40316361-b0dd89be-5d50-11e8-83e6-5511420efcb3.png)

显然最上面那两个异常是问题所在（下面那个异常没影响，有空再研究）

https协议的网站如果用http访问外部资源，往往会收到这种限制，这种情况最好统一一下，大家用同样的协议即可，显然我不能改github的协议，那只能改主题代码了

还是一波全局搜索，还是那个文件

```
<link href="http://cdn.bootcss.com/bootstrap/3.3.7/css/bootstrap.min.css" rel="stylesheet">
<link href="http://cdn.bootcss.com/font-awesome/4.6.3/css/font-awesome.min.css" rel="stylesheet">
```

改成https即可，但可以再优雅点

```
<link href="//cdn.bootcss.com/bootstrap/3.3.7/css/bootstrap.min.css" rel="stylesheet">
<link href="//cdn.bootcss.com/font-awesome/4.6.3/css/font-awesome.min.css" rel="stylesheet">
```

发布，验证，搞定，顺便提了个pull request。

## 氪金项目:绑定自己的域名

> 友情提示：到了这步，再往下就需要氪金了。。。

虽然博客已经可以用了，但毕竟是个二级域名（acupt.github.io），如果想让自己的博客更有逼格，可以绑定一个自己的域名。

域名一般在阿里云或者腾讯云就可以买，比较方便，而且因为github服务器在国外，可以直接解析你的域名到github页面，无须备案。如果是自己买的国内服务器，那么想绑定域名则需要备案（在哪买服务器在哪备案），比较麻烦。

1. 购买域名：国内玩家首选 [阿里云](https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=j4qlf5nj)
2. 配置域名解析：购买域名后进入阿里云控制台，添加域名解析，记录类型选择CNAME，记录值为你的博客地址（acupt.github.io）
3. 添加CNAME文件：在acupt.github.io仓库根目录添加一个文件CNAME（没有扩展名），内容是你的域名：

参考 [我的](https://github.com/acupt/acupt.github.io/blob/master/CNAME)

```
acupt.cn
www.acupt.cn
```

我配置了两个域名，一个主域名acupt.cn，一个大家比较熟悉的www.acupt.cn（最后还是被重定向到主域名了），如果访问acupt.github.io也会被重定向到acupt.cn。

HTTPS支持：使用自己的域名后一般会变成http访问，因为你没有SSL证书。这个也是可以支持的，但由于我没操作过，就不写了。但我的网站仍然是https，为何？一开始我的绑定域名后是http，过了一两天有一个页面访问时被重定向成https，令人困惑。又过了几天，全部都是https了。。。网上没找到太多资料，似乎这是github一个没完全开放的功能？

## 氪金项目:使用自己的服务器

> 不氪金，你怎么变强？

github虽好，速度是硬伤，如果想自己的博客访问速度更快，拥有一台服务器很重要。

当然开源中国的码云也提供了个人主页功能，速度虽然快点，但限制颇多，比如绑定自己的域名也要收钱（是的，还要再给开源中国钱，这钱买个服务器岂不快哉）。

推荐几个云服务器选择：

1. [亚马逊](https://aws.amazon.com/cn/)：国外的公司，网站不太服务国人习惯，而且反馈问题一般要用英文，不太方便。
    亚马逊可以薅羊毛，新用户绑定信用卡后有个最低级的云服务器一年使用权，注意要信用卡。当初搞了个一年的服务器，因为在国外，就趁机搭建了一个翻墙服务器爽了几天。
    薅羊毛注意：一年到期不会自动消失，会开始扣费（信用卡），注意提前关闭，或者留意官方的英文提醒邮件，不然。。。（我想静静）
2. [腾讯云](https://cloud.tencent.com/act/cps/redirect?redirect=1044&cps_key=c637068243af062f0a0313805c474dac&from=console)：用过，没啥毛病，每天参与秒杀，运气好可以抢到很便宜而且性能不错的服务器。
3. [阿里云](https://promotion.aliyun.com/ntms/yunparter/invite.html?userCode=j4qlf5nj)：依然是国内玩家首选，

腾讯云和阿里云都有针对学生党的优惠，月租很便宜，相当于一个视频会员，社会人也没关系，新人也是有优惠的，不是新人？都是老相识了该氪就氪吧~

## The End

这篇帖子是2018年写的了，今天（2019-08-02）我又翻出来编bian辑shi了一下。所以我的博客其实已经换了个低调的主题了（时间会使人成熟）。

改进项目：

1. 新增域名绑定
2. 新增两项氪金项目

