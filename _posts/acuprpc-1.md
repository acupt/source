---
title: 从0.5到1写个rpc框架 - 1:服务注册/发现(eureka)
date: 2018-11-29 10:00:00
tags:
 - 微服务
 - eureka
 - spring
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

```
- acuprpc
    + acuprpc-core  //server/client核心处理逻辑
    + acuprpc-spring-boot-starter  //server端服务扫描，client端动态代理，服务注册/发现
```

## Eureka Server

[spring-cloud-starter-eureka-server](https://blog.csdn.net/forezp/article/details/69696915)

## Eureka Client

原理就是利用eureka提供的客户端类来向Eureka Server发送注册请求，把自己提供服务的地址和端口（rpc服务端口，不是springboot启动的http端口）告诉注册中心，这样其他客户端（包括自身）就可以请求Eureka Server获取需要的服务节点信息。

```java
/**
 * 在服务中心注册的实例
 */
@Getter
@Slf4j
public class RpcInstance {

    private EurekaClient eurekaClient;

    private ApplicationInfoManager applicationInfoManager;

    private RpcConf rpcConf;

    public RpcInstance(RpcConf rpcConf) {
        RpcEurekaInstanceConfig instanceConfig = new RpcEurekaInstanceConfig();

        instanceConfig.setAppGroupName(rpcConf.getAppGroup());
        instanceConfig.setAppname(rpcConf.getAppName());
        instanceConfig.setNonSecurePort(rpcConf.getPort());
        instanceConfig.setIpAddress(IpUtil.INTRANET_IP);
        instanceConfig.setHostname(IpUtil.HOSTNAME);

        RpcEurekaClientConfig clientConfig = new RpcEurekaClientConfig();
        clientConfig.getServiceUrl().put("default", rpcConf.getDiscoveryServiceUrl());
        clientConfig.setRegisterWithEureka(rpcConf.isRegisterWithDiscovery());

        InstanceInfo instanceInfo = new EurekaConfigBasedInstanceInfoProvider(instanceConfig).get();
        this.applicationInfoManager = new ApplicationInfoManager(instanceConfig, instanceInfo);
        this.eurekaClient = new DiscoveryClient(applicationInfoManager, clientConfig);
        this.rpcConf = rpcConf;
        log.info("protocol server -> " + rpcConf.getRpcServerClass());
        log.info("protocol client -> " + rpcConf.getRpcClientClass());
    }

    public void start() {
        applicationInfoManager.setInstanceStatus(InstanceInfo.InstanceStatus.STARTING);
    }

    public void started() {
        applicationInfoManager.setInstanceStatus(InstanceInfo.InstanceStatus.UP);
    }

    public void shutdown() {
        applicationInfoManager.setInstanceStatus(InstanceInfo.InstanceStatus.DOWN);
        eurekaClient.shutdown();
    }

    /**
     * 创建一个rpc server，根据配置的调用方式（实现类）生成对象
     */
    @SneakyThrows
    public RpcServer newRpcServer() {
        return rpcConf.getRpcServerClass().getConstructor(RpcInstance.class).newInstance(this);
    }

    /**
     * 创建一个rpc client，根据配置的调用方式（实现类）生成对象
     */
    @SneakyThrows
    public RpcClient newRpcClient(NodeInfo nodeInfo) {
        return rpcConf.getRpcClientClass().getConstructor(NodeInfo.class).newInstance(nodeInfo);
    }
}

```

## starter

构建一个自己的spring boot starter，这样别的项目只需要引入这个依赖，就能使用starter提供的服务了。

```
- resources
    - META-INF
        spring.factories // 定义@Configuration类的路径，有了这个声明依赖starter的项目就能获得starter中提供的bean
        spring-configuration-metadata.json // 配置信息（可选），有了它在IDE中编辑application配置文件可以看到提示信息
```

### rpc server 服务管理

作为rpc服务提供者，需要在应用启动时把有注解（@Rpc）的服务管理起来，这样接收到rpc请求后可以快速查询到指定对象，执行指定方法。

实现接口BeanPostProcessor的bean即可得到处理spring中的所有bean（每个bean初始化完成后会调用接口方法）。

```java

public class RpcServiceScanner implements BeanPostProcessor {

    private RpcServer rpcServer;

    public RpcServiceScanner(RpcServer rpcServer) {
        this.rpcServer = rpcServer;
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        // AOP代理类需要拿到原始的类，不然读不到类上的注解
        Class<?> beanClass = AopUtils.isAopProxy(bean) ? AopUtils.getTargetClass(bean) : bean.getClass();
        val nrpc = beanClass.getAnnotation(Rpc.class);
        if (nrpc == null) {
            return bean;
        }

        Method[] methods = beanClass.getDeclaredMethods();
        if (methods.length == 0) {
            return bean;
        }
        Map<String, MethodInfo> methodInfoMap = new HashMap<>();
        for (Method method : methods) {
            methodInfoMap.put(method.getName(), new MethodInfo(method));
        }

        Class<?>[] interfaces = beanClass.getInterfaces();
        if (interfaces.length == 0) {
            return bean;
        }
        // client是通过接口调用server的，因此并不知道具体实现类的路径，只有接口名，因此把所有接口都注册一遍
        for (Class<?> serviceInterface : interfaces) {
            rpcServer.registerService(
                    new RpcServiceInfo(rpcServer.getRpcInstance().getRpcConf().getAppName(),
                            serviceInterface.getCanonicalName()),
                    bean,
                    serviceInterface,
                    methodInfoMap);
        }
        return bean;
    }
}
```

### rpc client 远程服务代理

作为服务调用者，可以通过接口像调用本地代码一样调用远程服务，原理就是为接口创建一个代理，在代理中进行远程调用。

这里使用主动创建代理的方式。

```java
public class RpcServiceConsumer {

    private RpcClientManager rpcClientManager;

    public RpcServiceConsumer(RpcClientManager rpcClientManager) {
        this.rpcClientManager = rpcClientManager;
    }

    @SuppressWarnings("unchecked")
    public <T> T create(String appName, Class<T> serviceInterface) {
        RpcServiceInfo serviceInfo = new RpcServiceInfo(appName, serviceInterface.getCanonicalName());
        return (T) Proxy.newProxyInstance(
                serviceInterface.getClassLoader(),
                new Class<?>[]{serviceInterface},
                new RpcInvocationHandler(serviceInfo, rpcClientManager));
    }
}
```

```java
public class RpcInvocationHandler implements InvocationHandler {

    private RpcServiceInfo rpcServiceInfo;

    private RpcServiceManager rpcServiceManager;

    private RpcClient rpcClient;

    public RpcInvocationHandler(RpcServiceInfo rpcServiceInfo, RpcServiceManager rpcServiceManager) {
        this.rpcServiceInfo = rpcServiceInfo;
        this.rpcServiceManager = rpcServiceManager;
        tryInitRpcClient(false);
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        RpcMethodInfo methodInfo = new RpcMethodInfo(rpcServiceInfo, method.getName(), method.getGenericReturnType());
        return tryGetRpcClient().invoke(methodInfo, args);
    }

    private RpcClient tryGetRpcClient() {
        if (rpcClient == null) {
            tryInitRpcClient(true);
        }
        return rpcClient;
    }

    private synchronized void tryInitRpcClient(boolean throwError) {
        if (rpcClient != null) {
            return;
        }
        try {
            rpcClient = rpcServiceManager.lookup(rpcServiceInfo);
        } catch (Exception e) {
            if (throwError) {
                throw e;
            }
        }
    }
}
```

注册一个ApplicationListener，接收springboot程序准备完后的信号，然后告诉注册中心准备好了。

```java
public class RpcApplicationListener implements ApplicationListener<ApplicationReadyEvent> {

    private RpcServer rpcServer;

    public RpcApplicationListener(RpcServer rpcServer) {
        this.rpcServer = rpcServer;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        rpcServer.started();
    }
}
```