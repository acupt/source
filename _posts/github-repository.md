---
title: github搭建个人maven仓库
date: 2018/5/20 15:00:00
tags:
 - github
 - maven
categories: 教程
thumbnail: /images/github-blackboard.jpg
---

## 新建仓库

+ 在github新建一个普通的仓库即可，我的仓库地址 https://github.com/acupt/repository.git

+ 克隆到本地

```
➜  github git clone https://github.com/acupt/repository.git
Cloning into 'repository'...


remote: Counting objects: 3, done.
remote: Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
Unpacking objects: 100% (3/3), done.
➜  github cd repository 
➜  repository git:(master) ls
README.md
➜  repository git:(master) pwd
/Users/yunpian/github/repository
```


## 发布到本地

+ 用deploy命令发布项目，指定打包的文件输出到上一步克隆的本地仓库，在项目根目录下执行以下指令

```
mvn deploy -DaltDeploymentRepository=acupt-repository::default::file:/Users/yunpian/github/repository/
```

## 同步到远程仓库

+ 不想用master可以新建个分支

```
git branch snapshot
git push origin snapshot
git checkout snapshot
```

+ git add/commit/push

```
➜  repository git:(snapshot) ✗ git add com/

➜  repository git:(snapshot) ✗ git commit -m "acupsession"
[snapshot 4409029] acupsession
 12 files changed, 74 insertions(+)
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/acupsession-1.0-20180519.110225-1.jar
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/acupsession-1.0-20180519.110225-1.jar.md5
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/acupsession-1.0-20180519.110225-1.jar.sha1
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/acupsession-1.0-20180519.110225-1.pom
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/acupsession-1.0-20180519.110225-1.pom.md5
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/acupsession-1.0-20180519.110225-1.pom.sha1
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/maven-metadata.xml
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/maven-metadata.xml.md5
 create mode 100644 com/acupt/acupsession/1.0-SNAPSHOT/maven-metadata.xml.sha1
 create mode 100644 com/acupt/acupsession/maven-metadata.xml
 create mode 100644 com/acupt/acupsession/maven-metadata.xml.md5
 create mode 100644 com/acupt/acupsession/maven-metadata.xml.sha1
 
➜  repository git:(snapshot) ✗ git push
Counting objects: 18, done.
Delta compression using up to 8 threads.
Compressing objects: 100% (8/8), done.
Writing objects: 100% (18/18), 12.50 KiB | 6.25 MiB/s, done.
Total 18 (delta 1), reused 0 (delta 0)
remote: Resolving deltas: 100% (1/1), done.
To https://github.com/acupt/repository.git
   3951922..4409029  snapshot -> snapshot
➜  repository git:(snapshot) ✗ 
```

## 测试

到这里已经ok了，通过GitHub提供的域名可以下载maven依赖，但无法查看列表，地址：

https://raw.github.com/acupt/repository/snapshot

+ 新建maven项目
+ 修改pom.xml

```
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.acupt</groupId>
    <artifactId>acupdemo</artifactId>
    <version>1.0-SNAPSHOT</version>

    <repositories>
        <repository>
            <id>acupt-repository</id>
            <url>https://raw.github.com/acupt/repository/snapshot</url>
        </repository>
    </repositories>

    <dependencies>
        <dependency>
            <groupId>com.acupt</groupId>
            <artifactId>acupsession</artifactId>
            <version>1.0-SNAPSHOT</version>
        </dependency>
    </dependencies>
</project>
```
+ 查看本地maven仓库，看看jar包有没有下载成功

```
➜  acupsession cd ~/.m2/repository/com/acupt/acupsession/1.0-SNAPSHOT 
➜  1.0-SNAPSHOT ls
acupsession-1.0-20180519.110225-1.jar              acupsession-1.0-SNAPSHOT.jar
acupsession-1.0-20180519.110225-1.jar.sha1         acupsession-1.0-SNAPSHOT.pom
acupsession-1.0-20180519.110225-1.jar.tmp.sha1.tmp maven-metadata-acupt-repository.xml
acupsession-1.0-20180519.110225-1.pom              maven-metadata-acupt-repository.xml.sha1
acupsession-1.0-20180519.110225-1.pom.sha1         maven-metadata-acupt-repository.xml.tmp.sha1.tmp
acupsession-1.0-20180519.110225-1.pom.tmp.sha1.tmp maven-metadata-snapshots.xml
```

运气不错，成功了。



