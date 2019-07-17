---
title: CPU占用高如何排查
date: 2019-07-17 22:30:00
tags:
 - cpu
categories: 面试杂谈
---

> 程序里少不了运算，如果不是环境太恶劣，CPU基本是能支撑应用运行的。但如果发现CPU居高不下，就需要思考是否程序有问题。

当服务器CPU居高不下，可以从下面几个方面入手定位问题。

## 找到JAVA进程 pid

### 方法一: jps

那个jar就是我的一个java程序

```java
[root@iZba13i1mo82ot7a3lhq5oZ ~]# jps
17616 Jps
26016 jar
9353 Bootstrap
26028 Bootstrap
16812 Bootstrap
```

### 方法二: ps -ef|grep 应用关键词

和方法一找到的pid是相同的，26016

```java
[root@iZba13i1mo82ot7a3lhq5oZ ~]# ps -ef|grep acupjava
root     17638 17550  0 22:34 pts/0    00:00:00 grep --color=auto acupjava
root     26016     1  0 7月08 ?       00:05:11 java -jar acupjava-1.0-SNAPSHOT.jar
```

## 找到进程中CPU高的线程 tid

打印出线程线程基本信息，找到cpu百分比高的一个或几个线程，记住它们的tid。

PS：栗子质量不好，全是0.0%，不要在意~

```java
[root@iZba13i1mo82ot7a3lhq5oZ ~]# ps -mp 26016 -o THREAD,tid,time
USER     %CPU PRI SCNT WCHAN  USER SYSTEM   TID     TIME
root      0.0   -    - -         -      -     - 00:05:11
root      0.0  19    - futex_    -      - 26016 00:00:00
root      0.0  19    - futex_    -      - 26017 00:00:02
root      0.0  19    - futex_    -      - 26018 00:00:00
root      0.0  19    - futex_    -      - 26019 00:00:00
root      0.0  19    - futex_    -      - 26020 00:00:11
(略...)
```

## 打印线程栈

选择一个线程，把tid从10进制转为16进制

```java
[root@iZba13i1mo82ot7a3lhq5oZ ~]# printf "%x\n" 26017
65a1
```

为了方便查看可以把线程栈打印到文件里，jstack pid >> 文件名

使用ls查看文件已经存在

```java
[root@iZba13i1mo82ot7a3lhq5oZ ~]# jstack 26016 >> stack.txt
[root@iZba13i1mo82ot7a3lhq5oZ ~]# ls
test  stack.txt
```

## 找到占用CPU高的线程

打开文件，搜索tid所在位置，可以看到线程栈，由此分析定位可能有问题的代码。

```java
"http-nio-9527-AsyncTimeout" #29 daemon prio=5 os_prio=0 tid=0x00007fbf68973800 nid=0x65a1 waiting on condition [0x00007fbf48ab0000]
   java.lang.Thread.State: TIMED_WAITING (sleeping)
        at java.lang.Thread.sleep(Native Method)
        at org.apache.coyote.AbstractProtocol$AsyncTimeout.run(AbstractProtocol.java:1200)
        at java.lang.Thread.run(Thread.java:748)
```

如此这般，CPU高的问题基本就能定位出来了。（PS: 以上数据做了些许脱敏处理）