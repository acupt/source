---
title: Linux实践 - 创建用户
date: 2019-10-24 22:00:00
tags:
 - linux
 - centos
categories: linux
---

## 目标

创建一个admin用户用于日常操作（root权限太高，不宜直接使用）。

## 创建新用户

> adduser [用户名]

```sh
[root@VM_0_8_centos ~]# adduser admin
```

## 设置密码

> passwd [用户名]

系统对密码有一定要求，不能太简单，不然。。。

```sh
[root@VM_0_8_centos ~]# passwd admin
更改用户 admin 的密码 。
新的 密码：
无效的密码： 密码未通过字典检查 - 它没有包含足够的不同字符
重新输入新的 密码：
抱歉，密码不匹配。
新的 密码：
无效的密码： 密码未通过字典检查 - 过于简单化/系统化
重新输入新的 密码：
抱歉，密码不匹配。
新的 密码：
无效的密码： 密码未通过字典检查 - 它基于字典单词
重新输入新的 密码：
抱歉，密码不匹配。
passwd: 已经超出服务重试的最多次数
[root@VM_0_8_centos ~]# 
[root@VM_0_8_centos ~]# 
[root@VM_0_8_centos ~]# 
[root@VM_0_8_centos ~]# passwd admin
更改用户 admin 的密码 。
新的 密码：
[root@VM_0_8_centos ~]# passwd admin
更改用户 admin 的密码 。
新的 密码：
重新输入新的 密码：
passwd：所有的身份验证令牌已经成功更新。
[root@VM_0_8_centos ~]# 
```

## 用新用户登录

用刚创建的用户登陆一下试试。

PS: 记不住ip，所以在个人电脑的hosts文件中设置了个别名，因为用的腾讯云服务器，就叫qqcloud。

```sh
➜  hexo ssh admin@qqcloud 
The authenticity of host 'qqcloud (马赛克)' can't be established.
ECDSA key fingerprint is SHA256:马赛克.
Are you sure you want to continue connecting (yes/no)? yes
Warning: Permanently added 'qqcloud' (ECDSA) to the list of known hosts.
admin@qqcloud's password: 
Last failed login: Thu Oct 24 19:00:16 CST 2019 from 马赛克 on ssh:notty
There were 286 failed login attempts since the last successful login.
[admin@VM_0_8_centos ~]$ 
```

有句话引起我的注意:

> There were 286 failed login attempts since the last successful login.

就这一会已经被尝试登录286次了，想必是一些恶意的程序在乱扫乱试，难怪不让我用简单密码。


## sudo

> sudo [root用户专属命令]

虽然root用户不适合日常使用，但偶尔还是需要它的力量，比如改改hosts。这些敏感指令需要root权限，当使用非root权限用户登录时想执行这些命令，只需要在
命令前面加上sudo。

```sh
[admin@VM_0_8_centos ~]$ sudo vim /etc/hosts

我们信任您已经从系统管理员那里了解了日常注意事项。
总结起来无外乎这三点：

    #1) 尊重别人的隐私。
    #2) 输入前要先考虑(后果和风险)。
    #3) 权力越大，责任越大。

[sudo] admin 的密码：
admin 不在 sudoers 文件中。此事将被报告。
[admin@VM_0_8_centos ~]$ 
```

新用户没有sudo权限。而且，虽然我的机器默认是中文似乎有点low，但其实看这些提示挺方便的。

## 授权sudo给新用户

> vim /etc/sudoers

打开配置文件后找到root用户的配置，照着样子把admin也加上。保存时提示文件为只读，强行保存就行了（wq!）。

[vim用法](https://www.baidu.com/s?wd=linux%20vim)

```sh
## Next comes the main part: which users can run what software on 
## which machines (the sudoers file can be shared between multiple
## systems).
## Syntax:
##
##      user    MACHINE=COMMANDS
##
## The COMMANDS section may have other options added to it.
##
## Allow root to run any commands anywhere 
root    ALL=(ALL)       ALL
admin   ALL=(ALL)       ALL

#sudo时不需要输入密码
#admin   ALL=(ALL)       NOPASSWD:ALL
```

## 免密登录

自己的电脑登录自己的云服务器，还要锤子密码。

先在云服务器上初始化，命令:

> ssh-keygen

需要输入的地方直接回车即可。

```sh
[admin@VM_0_8_centos ~]$ ssh-keygen
Generating public/private rsa key pair.
Enter file in which to save the key (/home/admin/.ssh/id_rsa): 
Created directory '/home/admin/.ssh'.
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /home/admin/.ssh/id_rsa.
Your public key has been saved in /home/admin/.ssh/id_rsa.pub.
The key fingerprint is:
SHA256:马赛克 admin@VM_0_8_centos
The key's randomart image is:
+---[RSA 2048]----+
|     马赛克       |
|      马赛克      |
|     马赛克 ++o   |
|      马赛克      |
|     马赛克       |
|  马赛克马赛克     |
|  马赛克马赛克     |
|   马赛克马赛克    |
|   马赛克马赛克    |
+----[SHA256]-----+
```

生成目录: /home/admin/.ssh

```sh
[admin@VM_0_8_centos .ssh]$ pwd
/home/admin/.ssh
[admin@VM_0_8_centos .ssh]$ ll
总用量 8
-rw------- 1 admin admin 1679 10月 25 00:23 id_rsa
-rw-r--r-- 1 admin admin  401 10月 25 00:23 id_rsa.pub
[admin@VM_0_8_centos .ssh]$ 
```

+ id_rsa 秘钥，需要保密
+ id_rsa.pub 公钥，暴露给别人

因为需要这台服务器对某些机器信任，让它们不需要输入密码也能进来，所以需要维护一个被信任用户的列表，列表里面是被信任用户的唯一标识，也就是对方的公钥。

在/home/admin/.ssh目录下创建一个文件authorized_keys，然后把希望被信任的电脑的公钥输入进去，多个换行隔开即可。

还差点，需要把authorized_keys的权限设为600，否则不生效。

> chmod 600 authorized_keys 

done