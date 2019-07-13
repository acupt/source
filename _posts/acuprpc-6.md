---
title: 从0.5到1写个rpc框架 - 6:调用异常节点自动重试
date: 2019-07-13 15:00:00
tags:
 - 微服务
 - eureka
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

eureka client每隔30s向注册中心发送心跳来给自己续命，当注册中心长时间没收到client的信号，就会认为它挂掉了，把它提出群聊。再加上其它服务也按照一定频率更新本地缓存，因此往往不会那么及时地发现曾经的小伙伴已经下线了。导致的后果就是，会向不再存在的节点发送请求，结果连接异常。

对此，我们可以从框架层面加入一个重试机制，spring里面类似的机制也有，但既然在写自己的框架，那就自己实现一个。

在第一章里已经实现了通过动态代理执行远程调用，那么直接从这里入手，通过判断捕获的异常来判断是否需要重试。

```java
@Override
    public Object invoke(Object proxy, Method method, Object[] args) {
        if ("toString".equals(method.getName()) && (args == null || args.length == 0)) {
            return rpcServiceInfo.toString();//debug时老是被ide调用然后抛异常，很烦
        }
        RpcRequest rpcRequest = new RpcRequest(rpcServiceInfo.getAppName(), rpcServiceInfo.getServiceName(), method.getName());
        if (args != null && args.length > 0) {
            rpcRequest.setOrderedParameter(Arrays.stream(args).map(JsonUtil::toJson).collect(Collectors.toList()));
        }
        int n = 3; // 最多重试3次，改成可配置的更好
        int i = 0;
        RpcClient client = null;
        while (i++ < n) {
            try {
                client = getRpcClient();
                String res = client.invoke(rpcRequest);
                return JsonUtil.fromJson(res, TypeFactory.defaultInstance().constructType(method.getGenericReturnType()));
            } catch (Exception e) {
                if (client == null) {
                    throw e;
                }
                boolean rediscover = needRediscover(e) && i < n;
                log.error("invoke {}/{} {} {} error={} msg={} rediscover={}",
                        i, n, rpcRequest.getKey(), client.getNodeInfo(), e.getClass().getName(), e.getMessage(), rediscover);
                if (rediscover) {
                    try {
                        NodeInfo nodeInfo = rpcClientManager.selectNode(rpcServiceInfo, client.getNodeInfo());
                        client.reconnect(nodeInfo);
                        continue;
                    } catch (RpcNotFoundException e1) {
                        e.addSuppressed(e1);
                    }
                }
                throw e;
            }
        }
        throw new RuntimeException("invoke error");
    }

    /**
     * 根据异常类型判断是否需要换个实例
     */
    private boolean needRediscover(Throwable e) {
        while (e != null) {
            if (e instanceof HttpStatusException) {
                // 我自定义的异常类型，这里如果是服务不可用（程序虽然正常但不再提供服务）
                if (((HttpStatusException) e).getStatus() == NOT_AVAILABLE) {
                    return true;
                }
            } else if (e instanceof ConnectException) {
                // 连接异常，想必是不在了
                return true;
            }
            e = e.getCause();
        }
        return false;
    }
```

有了重试机制，就不怕某些家伙突然掉链子了，当然如果全部掉链子那就没得玩了。