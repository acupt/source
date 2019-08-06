---
title: 从0.5到1写个rpc框架 - 7:网关支持(gateway)
date: 2019-07-13 16:15:00
tags:
 - 微服务
 - eureka
 - spring
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

微服务除了在内部相互调用，有时某些服务也会提供给外部应用。当然不能让外部应用也加入到“大家庭”里，毕竟知人知面不知源码，我们可以派出一个“前台”去接待它们，这就是“网关”。

![gateway](/img/micro-service/gateway.png)

网关负责对接外部来宾，因此要做好安全措施，什么登陆、权限该上就上。

流程如下：
+ 网关收到请求
+ 解析请求（服务名，方法，参数等）
+ 选择一个实例（来自注册中心）
+ RPC调用
+ 结果返回给请求方

```java
@RestController
@RequestMapping("/api")
public class ApiController {

    /**
     * 动态调用rpc服务的关键，在acuprpc-spring-boot-starter中已经生成，可以随时引用
     */
    private RpcClientManager rpcClientManager;

    public ApiController(RpcClientManager rpcClientManager) {
        this.rpcClientManager = rpcClientManager;
    }

    @RequestMapping(method = RequestMethod.POST, produces = "application/json")
    public Object invoke(@RequestBody RpcRequestDTO requestDTO) {
        RpcServiceInfo serviceInfo = new RpcServiceInfo(requestDTO.getApp(), requestDTO.getService());
        RpcClient client = rpcClientManager.lookup(serviceInfo);//获取一个可以提供所需服务的连接
        RpcRequest request = new RpcRequest(requestDTO.getApp(), requestDTO.getService(), requestDTO.getMethod());
        if (requestDTO.getParameters() != null) {
            Map<String, String> map = new HashMap<>();
            requestDTO.getParameters().forEach((k, v) -> map.put(k, JsonUtil.toJson(v)));
            request.setNamedParameter(map);
        }
        return client.invoke(request);//调用服务获得返回的json字符串
    }
}
```

这个demo作为一个子模块（acuprpc-spring-boot-starter-gateway）加入了框架的全家桶，直接引入依赖就能使用这个功能。

基于这个方法，可以实现更加复杂的也无需求，这里就不细讲了，本系列结束。