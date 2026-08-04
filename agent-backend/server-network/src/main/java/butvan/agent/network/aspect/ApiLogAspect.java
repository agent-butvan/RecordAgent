package butvan.agent.network.aspect;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Arrays;

/**
 * 后端 REST API 规范化请求与响应日志打印切面
 */
@Slf4j
@Aspect
@Component
public class ApiLogAspect {

    /**
     * 切入点：拦截 controller 包下所有 REST 接口方法
     */
    @Pointcut("execution(* butvan.agent.network.controller..*.*(..))")
    public void apiPointcut() {
    }

    /**
     * 环绕通知：拦截 API 请求并规范化输出请求参数、耗时及响应结果
     *
     * @param joinPoint 切入点对象
     * @return 接口响应结果
     * @throws Throwable 运行异常
     */
    @Around("apiPointcut()")
    public Object logAround(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();

        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes != null ? attributes.getRequest() : null;

        String httpMethod = request != null ? request.getMethod() : "UNKNOWN";
        String requestUri = request != null ? request.getRequestURI() : "UNKNOWN";
        String remoteAddr = request != null ? request.getRemoteAddr() : "UNKNOWN";
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();

        log.info("[API-LOG] >>> START | Method: [{} {}] | Client: [{}] | Handler: [{}.{}] | Args: {}",
                httpMethod, requestUri, remoteAddr, className, methodName, Arrays.toString(args));

        Object result;
        try {
            result = joinPoint.proceed();
            long timeTaken = System.currentTimeMillis() - startTime;
            log.info("[API-LOG] <<< END   | Method: [{} {}] | Status: [SUCCESS] | Cost: [{} ms] | Result: {}",
                    httpMethod, requestUri, timeTaken, result);
            return result;
        } catch (Throwable e) {
            long timeTaken = System.currentTimeMillis() - startTime;
            log.error("[API-LOG] <<< ERROR | Method: [{} {}] | Status: [FAILED]  | Cost: [{} ms] | Exception: [{}]",
                    httpMethod, requestUri, timeTaken, e.getMessage(), e);
            throw e;
        }
    }
}
