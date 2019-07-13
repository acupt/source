---
title: 从0.5到1写个rpc框架 - 0:前言
date: 2018-11-29 09:00:00
tags:
 - 微服务
 - rpc
 - grpc
 - thrift
 - eureka
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

最近在新公司开始接触微服务，在此之前并没有微服务的开发经验。对比了spring cloud和公司的rpc框架，对微服务这套东西终于有了一点粗浅的认知，为了加深理解，自己动手写个rpc框架玩玩。顺便记录下来，不然玩过的东西过段时间就忘了。

我的spring cloud的入门读物: [史上最简单的 SpringCloud 教程](https://blog.csdn.net/forezp/article/details/70148833/)

我的学习成果: [acuprpc](https://github.com/acupt/acuprpc)

### 设计方案

总的来说就是在现有工具上的二次开发。

+ 服务注册/发现: eureka
    
    这个模块spring cloud已经集成的非常易用了，实在没兴趣再整些骚操作，引入spring-cloud-starter-eureka-server依赖，启动类加个注解@EnableEurekaServer就是一个注册中心了。

+ 远程服务调用: grpc/thrift

    grpc是Google开源的rpc框架，thrift是Facebook开源的rpc框架，而且他们都支持跨语言，都是很厉害的东西，需要用它们的规则定义数据结构，每个服务都定义一次是挺累的，如果只定义一个通用的服务，然后在这个服务里面通过Java反射去执行对应方法就可以少很多工作量了（把工作量变成了Java代码编写）。

    至于选择这两种，因为都想试试，所以最终设计rpc框架是可以切换通信方式的，把这部分抽出来做成可扩展的即可。

### 目录

// 只要列出来，总有一天会写完。

+ [从0.5到1写个rpc框架 - 1:服务注册/发现(eureka)](/2018/11/29/acuprpc-1/)
+ [从0.5到1写个rpc框架 - 2:远程服务调用(grpc)](/2018/11/29/acuprpc-2/)
+ [从0.5到1写个rpc框架 - 3:远程服务调用(thrift)](/2018/11/29/acuprpc-3/)
+ [从0.5到1写个rpc框架 - 4:request filter](/2018/11/29/acuprpc-4/)
+ [从0.5到1写个rpc框架 - 5:服务监控和管理(actuator)](/2018/11/29/acuprpc-5/)
+ [从0.5到1写个rpc框架 - 6:调用异常节点自动重试](/2019/07/13/acuprpc-6)
+ [从0.5到1写个rpc框架 - 7:网关支持(gateway)](/2019/07/13/acuprpc-7)

