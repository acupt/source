---
title: 从0.5到1写个rpc框架 - 3:远程服务调用(thrift)
date: 2018-11-29 12:00:00
tags:
 - 微服务
 - thrift
 - spring
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

thrift是Facebook开源的rpc框架，基于TPC，默认使用二进制。

需要先掌握thrift的基本用法: [thrift-Java 示例](https://my.oschina.net/liujiest/blog/2878958)

## 项目结构

```
- acuprpc
    + acuprpc-core  //server/client核心处理逻辑
    + acuprpc-protocol-thrift  //基于thrift实现远程调用
    + acuprpc-spring-boot-starter  //server端服务扫描，client端动态代理，服务注册/发现
```

## thrift 通信

### 接口定义

定义服务提供者（server）和服务调用者（client）交流所用的数据结构，client需要告诉server要调用的类名、方法名以及参数（json格式的字符串，在server端再反序列化）。

resources/service.thrift

```java
namespace java com.acupt.acuprpc.protocol.thrift.proto
service ThriftService{
    InvokeResponse invokeMethod(1:InvokeRequest invokeRequest)
}

struct InvokeRequest{
1: required string appName;
2: required string serviceName;
3: required string methodName;
4: required list<string> orderedParameter;
5: required map<string,string> namedParameter;
}

struct InvokeResponse{
1: required i32 code;
2: optional string message;
3: optional string result;
}
```

### thrift-service

这个类负责接收 thrift-client 发过来的请求，取出请求中的参数，转换成通用的结构，交给core层的RpcServer去执行对应方法，然后将返回值序列化成json返回给 thrift-client。

```java
public class ThriftService implements com.acupt.acuprpc.protocol.thrift.proto.ThriftService.Iface {

    private RpcServer rpcServer;

    public ThriftService(RpcServer rpcServer) {
        this.rpcServer = rpcServer;
    }

    @Override
    public InvokeResponse invokeMethod(InvokeRequest invokeRequest) {
        RpcRequest rpcRequest = new RpcRequest(
                invokeRequest.getAppName(),
                invokeRequest.getServiceName(),
                invokeRequest.getMethodName(),
                invokeRequest.getOrderedParameter(),
                invokeRequest.getNamedParameter());
        RpcResponse rpcResponse = rpcServer.execute(rpcRequest);
        InvokeResponse response = new InvokeResponse();
        response.setCode(rpcResponse.getCode());
        response.setMessage(rpcResponse.getMessage());
        response.setResult(rpcResponse.getResultString());
        return response;
    }
}

```

### thrift-server

作物服务提供者的具体实现类，只需要实现两个方法：启动服务和关闭服务，其他的交给core层的父类即可。

由于thrift server 调用serve()方法后会阻塞线程，因此需要另外启动一个线程去开启服务。

```java
public class ThriftServer extends RpcServer {
    private static final int nThreads = 100;
    private TServer server;
    public ThriftServer(RpcInstance rpcInstance) {
        super(rpcInstance);
    }

    @Override
    protected void startRpc() {
        new Thread(() -> {
            TProcessor tprocessor = new com.acupt.acuprpc.protocol.thrift.proto.ThriftService.
                    Processor<com.acupt.acuprpc.protocol.thrift.proto.ThriftService.Iface>(new ThriftService(this));
            TServerTransport serverTransport = null;
            try {
                serverTransport = new TServerSocket(getRpcInstance().getRpcConf().getPort());
            } catch (TTransportException e) {
                throw new RpcException(e);
            }
            TThreadPoolServer.Args tArgs = new TThreadPoolServer.Args(serverTransport);
            tArgs.processor(tprocessor);
            tArgs.executorService(Executors.newFixedThreadPool(nThreads));
            server = new TThreadPoolServer(tArgs);
            server.serve();//阻塞
        }).start();
    }

    @Override
    protected void shutdownRpc() {
        if (server != null) {
            server.setShouldStop(true);
        }
    }
}
```

### thrift-client

作为服务调用者，需要把动态代理类传来的请求信息包装成thrift支持的结构，并调用thrift的请求方法，再把远程服务返回的结果返回给代理类。

thrift client 是线程不安全的，从它提供的方法就能够看出来。

```java
public void send_invokeMethod(InvokeRequest invokeRequest){
    //...
}

public InvokeResponse recv_invokeMethod(){
    //...
}

public InvokeResponse invokeMethod(InvokeRequest invokeRequest) throws org.apache.thrift.TException
{
    send_invokeMethod(invokeRequest);
    return recv_invokeMethod();
}
```

为了简单直接在把方法设为 synchronized ，后续再使用对象池

```java
public class ThriftClient extends RpcClient implements RpcCode {

    private AtomicReference<ThriftService.Client> clientRef;

    public ThriftClient(NodeInfo nodeInfo) {
        super(nodeInfo);
        clientRef = new AtomicReference<>(getClient(nodeInfo));
    }

    //todo client线程不安全，使用连接池管理
    @Override
    @SneakyThrows
    protected synchronized String remoteInvoke(RpcRequest rpcRequest) {
        InvokeRequest request = new InvokeRequest();
        request.setAppName(rpcRequest.getAppName());
        request.setServiceName(rpcRequest.getServiceName());
        request.setMethodName(rpcRequest.getMethodName());
        request.setOrderedParameter(rpcRequest.getOrderedParameter());
        InvokeResponse response = clientRef.get().invokeMethod(request);
        if (response.getCode() != SUCCESS) {
            throw new HttpStatusException(response.getCode(), response.getMessage());
        }
        return response.getResult();
    }

    @Override
    protected NodeInfo reconnectRpc(NodeInfo nodeInfo) {
        //...
    }

    @Override
    public void shutdownRpc() {
        close(clientRef.get());
    }

    private ThriftService.Client getClient(NodeInfo nodeInfo) {
        //...
    }

    private void close(ThriftService.Client client) {
        //...
    }
}
```
