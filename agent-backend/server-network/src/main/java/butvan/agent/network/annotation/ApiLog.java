package butvan.agent.network.annotation;

import java.lang.annotation.*;

/**
 * REST API 规范化日志记录自定义注解
 * 用于标注在 Controller 控制器接口方法上，描述该接口的功能作用并触发 AOP 切面日志记录
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface ApiLog {

    /**
     * 接口功能作用描述
     *
     * @return 接口作用描述文本
     */
    String value() default "";
}
