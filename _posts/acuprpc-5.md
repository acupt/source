---
title: 从0.5到1写个rpc框架 - 5:服务监控和管理(actuator)
date: 2018-11-29 14:00:00
tags:
 - 微服务
 - actuator
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

springboot项目中只要引入spring-boot-starter-actuator就可以得到一些管理服务的接口，比如停止服务，获取服务信息等。他用的并不是controller，而是Endpoint，不过主要功能差不多。

借住上节实现的filter机制，可以在不改动框架核心代码的基础上实现这个功能。作为实践写两个功能：获取服务端的统计数据、服务状态控制

新建模块 acuprpc-spring-boot-starter-actuator。

为了统一管理这个框架的endpoint，定义一个父类。所有子类的id默认加上“rpc”前缀

```java
public abstract class AbstractRpcEndpoint<T> extends AbstractEndpoint<T> {
    private static final String PREFIX = "rpc";

    public AbstractRpcEndpoint(String id) {
        super(PREFIX + id);
    }
    public AbstractRpcEndpoint(String id, boolean sensitive) {
        super(PREFIX + id, sensitive);
    }
    public AbstractRpcEndpoint(String id, boolean sensitive, boolean enabled) {
        super(PREFIX + id, sensitive, enabled);
    }
}
```

## 数据统计

### MonitorFilter

使用filter拦截请求，统计处理请求的数量。

```java
@Getter
public class MonitorFilter implements RpcFilter {

    private Map<String, RequestCount> requestCountMap = new ConcurrentHashMap<>();

    @Override
    public void doFilter(RpcRequest request, RpcResponse response, RpcFilterChain filterChain) {
        RequestCount count = requestCountMap.computeIfAbsent(request.getKey(), RequestCount::new);
        count.received.increment();
        count.invoking.increment();
        try {
            filterChain.doFilter(request, response);
            count.success.increment();
        } catch (Exception e) {
            count.failed.increment();
            throw e;
        } finally {
            count.invoking.decrement();
        }
    }

    @Getter
    public static class RequestCount {
        private String key;
        private LongAdder received = new LongAdder();//已接收
        private LongAdder invoking = new LongAdder();//执行中
        private LongAdder success = new LongAdder();//处理成功
        private LongAdder failed = new LongAdder();//处理失败

        public RequestCount(String key) {
            this.key = key;
        }
    }
}
```

### RpcStatEndpoint

提供http接口，通过 /rpcstat 即可获取invoke()的返回值。

```java
public class RpcStatEndpoint extends AbstractRpcEndpoint<Map<String, Object>> {
    private MonitorFilter filter;

    public RpcStatEndpoint(MonitorFilter filter) {
        super("stat");
        this.filter = filter;
    }

    @Override
    public Map<String, Object> invoke() {
        Map<String, Object> result = new HashMap<>();
        Collection<MonitorFilter.RequestCount> counts = filter.getRequestCountMap().values();
        result.put("counts", counts);
        result.put("serving", counts.stream().anyMatch(t -> t.getInvoking().sum() > 0L));
        return result;
    }
}
```

## 服务管理

### RejectFilter

使用filter拦截请求，并在filter中维护一个下线状态，如果下线了则拒绝所有请求（针对这种返回值，客户端可以重新发现其他节点）。

```java
@Data
public class RejectFilter implements RpcFilter {
    private boolean reject = false;
    //拒绝请求的处理逻辑也可以自定义
    private BiConsumer<RpcRequest, RpcResponse> rejectFunction = (rpcRequest, response) -> response.reject();

    @Override
    public void doFilter(RpcRequest request, RpcResponse response, RpcFilterChain filterChain) {
        if (reject) {
            rejectFunction.accept(request, response);
            return;
        }
        filterChain.doFilter(request, response);
    }
}
```
### EndpointMvcAdapter

Endpoint使用很方便，但是相对controller不是那么灵活，比如我要让接口支持参数，就需要一些其他操作，将Endpoint使用EndpointMvcAdapter包装一次。
为了复用，我写了个通用的EndpointMvcAdapter，通过反射去调用参数指定的方法。

```java
@Slf4j
public class ReflectEndpointMvcAdapter extends EndpointMvcAdapter implements RpcCode {
    private Map<String, Method> methodMap = new HashMap<>();
    private Set<String> ipWhiteList = new HashSet<>();

    public ReflectEndpointMvcAdapter(Endpoint<?> delegate, String ipWhiteList) {
        super(delegate);
        Method[] methods = delegate.getClass().getMethods();
        //...
    }

    @RequestMapping(value = "/{name:.*}", method = RequestMethod.GET, produces = {
            ActuatorMediaTypes.APPLICATION_ACTUATOR_V1_JSON_VALUE,
            MediaType.APPLICATION_JSON_VALUE
    })
    @ResponseBody
    @HypermediaDisabled
    public Object invoke(HttpServletRequest request, HttpServletResponse response, @PathVariable String name) {
        if (!checkIp(request)) {
            //...
        }
        Method method = methodMap.get(name);
        //...
        try {
            return method.invoke(getDelegate());
        } catch (Exception e) {
            //...
        }
    }

    private boolean checkIp(HttpServletRequest request) {
       //...
    }

    private String getIp(HttpServletRequest request) {
        //...
    }
}
```

### RpcEndpoint

因为要用ReflectEndpointMvcAdapter，invoke方法暂时没想到用什么（ /rpc 时调用），就返回null。

```java
public class RpcEndpoint extends AbstractRpcEndpoint<Object> implements RpcCode {
    private RejectFilter filter;

    public RpcEndpoint(RejectFilter filter) {
        super("");
        this.filter = filter;
    }

    @Override
    public Object invoke() {
        return null;
    }

    public void online() {
        filter.setReject(false);
    }

    public void offline() {
        filter.setReject(true);
    }

    public int status() {
        if (filter.isReject()) {
            throw new HttpStatusException(NOT_AVAILABLE);
        }
        return 0;
    }

}
```

定义bean时包装

```java
    @Bean
    public ReflectEndpointMvcAdapter rpcEndpoint(RejectFilter rejectFilter) {
        return new ReflectEndpointMvcAdapter(process(new RpcEndpoint(rejectFilter)), ipWhiteList);
    }

    private <T extends AbstractRpcEndpoint<?>> T process(T endpoint) {
        endpoint.setSensitive(sensitive);
        return endpoint;
    }
```

现在只要引入acuprpc-spring-boot-starter-actuator就能得到这几个http接口了，借助这几个接口服务可以优雅地重发。