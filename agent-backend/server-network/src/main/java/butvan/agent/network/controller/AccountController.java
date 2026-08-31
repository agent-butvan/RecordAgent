package butvan.agent.network.controller;

import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dto.account.AccountStatusResponse;
import butvan.agent.network.dto.account.BindEmailRequest;
import butvan.agent.network.dto.account.SendVerificationCodeRequest;
import butvan.agent.network.service.account.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** 当前设备的本地账户绑定接口。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/account")
@RequiredArgsConstructor
public class AccountController {
    private final AccountService accountService;

    /** 查询账户绑定状态。 */
    @ApiLog("查询本地账户绑定状态")
    @GetMapping("/status")
    public Result<AccountStatusResponse> status() {
        return Result.success(accountService.getStatus());
    }

    /** 向指定邮箱发送绑定验证码。 */
    @ApiLog("发送邮箱绑定验证码")
    @PostMapping("/verification-code")
    public Result<String> sendVerificationCode(@RequestBody SendVerificationCodeRequest request) {
        accountService.sendVerificationCode(request.getEmail());
        return Result.success("验证码已发送，请查收邮箱");
    }

    /** 验证邮箱并绑定到当前设备。 */
    @ApiLog("验证并绑定本地邮箱账户")
    @PostMapping("/bind")
    public Result<AccountStatusResponse> bind(@RequestBody BindEmailRequest request) {
        return Result.success("邮箱绑定成功", accountService.bindEmail(
                request.getEmail(), request.getPassword(), request.getVerificationCode()));
    }
}
