---
title: gRPC-Java 示例
date: 2018-10-23 20:19:56
tags:
---
<!-- ## gRPC-Java 示例 -->

### 新建maven项目

pom.xml

```xml
<dependencies>
        <dependency>
            <groupId>io.grpc</groupId>
            <artifactId>grpc-all</artifactId>
            <version>1.5.0</version>
        </dependency>
    </dependencies>
    <build>
        <extensions>
            <extension>
                <groupId>kr.motd.maven</groupId>
                <artifactId>os-maven-plugin</artifactId>
                <version>1.4.1.Final</version>
            </extension>
        </extensions>
        <plugins>
            <plugin>
                <groupId>org.xolstice.maven.plugins</groupId>
                <artifactId>protobuf-maven-plugin</artifactId>
                <version>0.5.0</version>
                <configuration>
                    <protocArtifact>com.google.protobuf:protoc:3.3.0:exe:${os.detected.classifier}</protocArtifact>
                    <pluginId>grpc-java</pluginId>
                    <pluginArtifact>io.grpc:protoc-gen-grpc-java:1.5.0:exe:${os.detected.classifier}
                    </pluginArtifact>
                    <!--*.proto文件目录-->
                    <protoSourceRoot>src/main/resources</protoSourceRoot>
                </configuration>
                <executions>
                    <execution>
                        <goals>
                            <goal>compile</goal>
                            <goal>compile-custom</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
```

### 定义服务

新建文件 src/main/resources/test.proto

![](../img/micro-service/test.proto.png)

```java
syntax = "proto3";

option java_multiple_files = true;
option java_package = "com.acupt.grpc.proto";
option java_outer_classname = "HelloProto";

package com.acupt.grpc;

service HelloService {
    rpc hello (InvokeRequest) returns (InvokeResponse) {
    }
}

message InvokeRequest {
    string name = 1;
}

message InvokeResponse {
    string msg = 1;
}
```

### 构建

使用maven插件根据.proto文件生成Java代码，插件已在pom.xml中配置，只需执行命令：

> mvn install

构建完成后可以在target中找到生成的Java代码，用这些代码可以实现gRPC远程调用。

![](../img/micro-service/test.proto.target.png)

但在项目中还无法直接引用上面的类，右键 -> Mark Directory as -> Generated Sources Root

![](../img/micro-service/generated-sources-root.png)

![](../img/micro-service/test.proto.target-2.png)

现在就可以在项目中引用了

### 代码

3个类

```java
package com.acupt.grpc;

import com.acupt.grpc.proto.HelloServiceGrpc;
import com.acupt.grpc.proto.InvokeRequest;
import com.acupt.grpc.proto.InvokeResponse;
import io.grpc.stub.StreamObserver;

/**
 * 服务实现类
 */
public class HelloService extends HelloServiceGrpc.HelloServiceImplBase {

    @Override
    public void hello(InvokeRequest request, StreamObserver<InvokeResponse> responseObserver) {
        System.out.println("request -> " + request);
        String name = request.getName();//自定义的字段名 name
        InvokeResponse response = InvokeResponse.newBuilder()
                .setMsg("hello," + name)//自定义的字段名 msg
                .build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
```

```java
package com.acupt.grpc;

import io.grpc.Server;
import io.grpc.ServerBuilder;

import java.io.IOException;

/**
 * 服务提供方
 *
 * @author liujie
 */
public class MyServer {
    public static void main(String[] args) throws IOException, InterruptedException {
        int port = 50051;
        Server server = ServerBuilder.forPort(port)
                .addService(new HelloService())
                .build()
                .start();
        System.out.println("started");
        Thread.sleep(1000 * 60 * 2);
        server.shutdown();
        System.out.println("shutdown");
    }
}
```

```java
package com.acupt.grpc;

import com.acupt.grpc.proto.HelloServiceGrpc;
import com.acupt.grpc.proto.InvokeRequest;
import com.acupt.grpc.proto.InvokeResponse;
import io.grpc.Channel;
import io.grpc.ManagedChannelBuilder;

/**
 * 服务调用方
 */
public class MyClient {

    public static void main(String[] args) {
        InvokeRequest request = InvokeRequest.newBuilder().setName("tom").build();
        Channel channel = ManagedChannelBuilder.forAddress("localhost", 50051).usePlaintext(true).build();
        HelloServiceGrpc.HelloServiceBlockingStub blockingStub = HelloServiceGrpc.newBlockingStub(channel);
        InvokeResponse response = blockingStub.hello(request);
        System.out.println(response.getMsg());
    }
}

```

先启动MyServer，成功启动后再启动MyClient

![](../img/micro-service/myserver.png)

![](../img/micro-service/myclient.png)