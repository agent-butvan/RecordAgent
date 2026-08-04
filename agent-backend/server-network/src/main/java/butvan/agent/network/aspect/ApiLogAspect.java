package butvan.agent.network.aspect;

import butvan.agent.network.annotation.ApiLog;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.Arrays;

/**
 * 后端 REST API 规范化请求与响应日志打印切面
 * 基于 @ApiLog 自定义注解进行精准拦截并输出包含接口作用描述的规范日志
 */
@Slf4j
@Aspect
@Component
public class ApiLogAspect {

    /**
     * 切入点：拦截标注了 @ApiLog 注解的 Controller 接口方法
     */
    @Pointcut("@annotation(butvan.agent.network.annotation.ApiLog)")
    public void apiLogPointcut() {
    }

    /**
     * 环绕通知：拦截标注了 @ApiLog 的 API 请求，并规范化输出接口功能描述、请求参数、耗时及响应结果
     *
     * @param joinPoint 切入点对象
     * @return 接口响应结果
     * @throws Throwable 运行异常
     */
    @Around("apiLogPointcut()")
    public Object logAround(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();

        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes != null ? attributes.getRequest() : null;

        // 提取 @ApiLog 注解中传入的接口描述属性
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        ApiLog apiLogAnnotation = method.getAnnotation(ApiLog.class);
        String description = apiLogAnnotation != null ? apiLogAnnotation.value() : "未命名接口";

        String httpMethod = request != null ? request.getMethod() : "UNKNOWN";
        String requestUri = request != null ? request.getRequestURI() : "UNKNOWN";
        String remoteAddr = request != null ? request.getRemoteAddr() : "UNKNOWN";
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = method.getName();
        Object[] args = joinPoint.getArgs();

        log.info("[API-LOG] >>> START | Description: [{}] | Method: [{} {}] | Client: [{}] | Handler: [{}.{}] | Args: {}",
                description, httpMethod, requestUri, remoteAddr, className, methodName, Arrays.toString(args));

        Object result;
        try {
            result = joinPoint.proceed();
            long timeTaken = System.currentTimeMillis() - startTime;
            log.info("[API-LOG] <<< END   | Description: [{}] | Method: [{} {}] | Status: [SUCCESS] | Cost: [{} ms] | Result: {}",
                    description, httpMethod, requestUri, timeTaken, result);
            return result;
        } catch (Throwable e) {
            long timeTaken = System.currentTimeMillis() - startTime;
            log.error("[API-LOG] <<< ERROR | Description: [{}] | Method: [{} {}] | Status: [FAILED]  | Cost: [{} ms] | Exception: [{}]",
                    description, httpMethod, requestUri, timeTaken, e.getMessage(), e);
            throw e;
        }
    }
}
