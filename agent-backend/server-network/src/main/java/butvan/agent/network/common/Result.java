package butvan.agent.network.common;

public class Result<T> {

    private Integer code;
    private String message;
    private T data;

    public Result() {
    }

    public Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public static <T> Result<T> success(T data) {
        return new Result<T>(200, "success", data);
    }

    public static <T> Result<T> success(String message, T data) {
        return new Result<T>(200, message, data);
    }

    public static <T> Result<T> error(String message) {
        return new Result<T>(500, message, null);
    }

    public static <T> Result<T> error(Integer code, String message) {
        return new Result<T>(code, message, null);
    }
}
