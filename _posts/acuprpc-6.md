---
title: 从0.5到1写个rpc框架 - 6:调用异常节点自动重试
date: 2018-11-29 15:00:00
tags:
 - 微服务
 - eureka
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

eureka client每隔30s向注册中心发送心跳来给自己续命，因此