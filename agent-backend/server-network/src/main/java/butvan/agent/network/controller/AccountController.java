package butvan.agent.network.controller;

import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dto.account.AccountStatusResponse;
import butvan.agent.network.dto.account.BindEmailRequest;
import butvan.agent.network.dto.account.SendVerificationCodeRequest;
import butvan.agent.network.file.model.FileAsset;
import butvan.agent.network.service.account.AccountAvatarService;
import butvan.agent.network.service.account.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

/** 当前设备的本地账户绑定接口。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/account")
@RequiredArgsConstructor
public class AccountController {
    private final AccountService accountService;
    private final AccountAvatarService avatarService;
    private final CurrentUserProvider currentUserProvider;

    /** 查询账户绑定状态。 */
    @ApiLog("查询本地账户绑定状态")
    @GetMapping("/status")
    public Result<AccountStatusResponse> status() {
        return Result.success(statusWithAvatar());
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
        accountService.bindEmail(request.getEmail(), request.getPassword(), request.getVerificationCode());
        return Result.success("邮箱绑定成功", statusWithAvatar());
    }

    /** 上传并替换当前用户头像。 */
    @ApiLog("上传本地账户头像")
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<AccountStatusResponse> uploadAvatar(@RequestPart("file") MultipartFile file) {
        avatarService.replace(ownerId(), file);
        return Result.success("头像已更新", statusWithAvatar());
    }

    /** 读取当前用户头像内容。 */
    @ApiLog("读取本地账户头像")
    @GetMapping("/avatar/content")
    public ResponseEntity<Resource> avatarContent() {
        FileAsset avatar = avatarService.current(ownerId());
        if (avatar == null) throw new IllegalArgumentException("尚未设置头像");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.mediaType()))
                .contentLength(avatar.sizeBytes())
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePrivate().immutable())
                .body(avatarService.content(ownerId()));
    }

    private AccountStatusResponse statusWithAvatar() {
        AccountStatusResponse status = accountService.getStatus();
        FileAsset avatar = avatarService.current(ownerId());
        status.setAvatarVersion(avatar == null ? null : avatar.id());
        return status;
    }

    private String ownerId() { return currentUserProvider.currentUserId(); }
}
