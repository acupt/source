---
title: 从0.5到1写个rpc框架 - 2:远程服务调用(grpc)
date: 2018-11-29 11:00:00
tags:
 - 微服务
 - grpc
 - spring
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

gRPC是Google开源的跨语言远程服务调用(RPC)框架，通信协议用的HTTP/2，数据传输默认用的protocol buffers（一种轻便高效的结构化数据存储格式，想比json更小更快，不过没有可读性）。

需要先掌握grpc的基本用法: [gRPC-Java 示例](https://acupt.github.io/2018/10/23/grpc-start/)

## 项目结构

```
- acuprpc
    + acuprpc-core  //server/client核心处理逻辑
    + acuprpc-protocol-grpc  //基于grpc实现远程调用
    + acuprpc-spring-boot-starter  //server端服务扫描，client端动态代理，服务注册/发现
```

## grpc通信

### 接口定义

定义服务提供者（server）和服务调用者（client）交流所用的数据结构，client需要告诉server要调用的类名、方法名以及参数（json格式的字符串，在server端再反序列化）。

```java
syntax = "proto3";

option java_multiple_files = true;
option java_package = "com.acupt.acuprpc.protocol.grpc.proto";
option java_outer_classname = "GrpcServiceProto";

package com.acupt.acuprpc.protocol.grpc.proto;

service GrpcService {
    rpc invokeMethod (InvokeRequest) returns (InvokeResponse) {
    }
}

message InvokeRequest {
    string appName = 1;
    string serviceName = 2;
    string methodName = 3;
    repeated string orderedParameter = 4;
    map<string, string> namedParameter = 5;
}

message InvokeResponse {
    int32 code = 1;
    string message = 2;
    string result = 3;
}
```

### grpc-service

这个类负责接收grpc-client发过来的请求，取出请求中的参数，转换成通用的结构，交给core层的RpcServer去执行对应方法，然后将返回值序列化成json返回给grpc-client。

```java
public class GrpcService extends GrpcServiceGrpc.GrpcServiceImplBase {

    private RpcServer rpcServer;

    public GrpcService(RpcServer rpcServer) {
        this.rpcServer = rpcServer;
    }

    @Override
    public void invokeMethod(InvokeRequest request, StreamObserver<InvokeResponse> responseObserver) {
        RpcRequest rpcRequest = new RpcRequest(
                request.getAppName(),
                request.getServiceName(),
                request.getMethodName(),
                request.getOrderedParameterList(),
                request.getNamedParameterMap());
        RpcResponse rpcResponse = rpcServer.execute(rpcRequest);
        InvokeResponse response = InvokeResponse.newBuilder()
                .setCode(rpcResponse.getCode())
                .setMessage(rpcResponse.getMessage())
                .setResult(rpcResponse.getResultString())
                .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
```

### grpc-server

作物服务提供者的具体实现类，只需要实现两个方法：启动服务和关闭服务，其他的交给core层的父类即可。

```java
public class GrpcServer extends RpcServer {

    private Server server;

    public GrpcServer(RpcInstance rpcInstance) {
        super(rpcInstance);
    }

    @SneakyThrows
    @Override
    protected void startRpc() {
        server = ServerBuilder
                .forPort(getRpcInstance().getRpcConf().getPort())
                .addService(new GrpcService(this))
                .build().start();
    }

    @Override
    protected void shutdownRpc() {
        if (server != null) {
            server.shutdown();
        }
    }
}
```

### grpc-client

作为服务调用者，需要把动态代理类传来的请求信息包装成grpc支持的结构，并调用grpc的请求方法，再把远程服务返回的结果返回给代理类。

```java
public class GrpcClient extends RpcClient implements RpcCode {

    private AtomicReference<GrpcServiceGrpc.GrpcServiceFutureStub> stubRef;

    public GrpcClient(NodeInfo nodeInfo) {
        super(nodeInfo);
        this.stubRef = new AtomicReference<>(getStub(nodeInfo));
    }

    @Override
    protected String remoteInvoke(RpcRequest rpcRequest) {
        InvokeRequest.Builder builder = InvokeRequest.newBuilder()
                .setAppName(rpcRequest.getAppName())
                .setServiceName(rpcRequest.getServiceName())
                .setMethodName(rpcRequest.getMethodName());
        // ...
        ListenableFuture<InvokeResponse> future = stubRef.get().invokeMethod(builder.build());
        InvokeResponse response = null;
        //...
        return response.getResult();
    }

    @Override
    @SneakyThrows
    protected NodeInfo reconnectRpc(NodeInfo nodeInfo) {
        //...使用参数中的ip和端口建立新连接，并断开老的连接，可用于重新负载和异常节点重试
    }

    @Override
    @SneakyThrows
    public void shutdownRpc() {
        //...主动断开和服务端的连接
    }

    private GrpcServiceGrpc.GrpcServiceFutureStub getStub(NodeInfo nodeInfo) {
        //...和服务端建立连接，使用参数中的ip和端口
    }
```
