package butvan.agent.network.context.controller;

import butvan.agent.agents.context.PersonalContextService;
import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.context.dto.PersonalContextDtos;
import butvan.agent.network.context.dto.PersonalContextDtos.Response;
import butvan.agent.network.context.dto.PersonalContextDtos.UpdateEnabledRequest;
import butvan.agent.network.context.dto.PersonalContextDtos.UpdateProfileRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 个人上下文设置的 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/personal-context")
@RequiredArgsConstructor
public class PersonalContextController {

    private final PersonalContextService personalContextService;
    private final CurrentUserProvider currentUserProvider;

    /** 查询当前画像、来源、开关与预算。 */
    @ApiLog("查询个人上下文设置")
    @GetMapping
    public Result<Response> get() {
        return Result.success(PersonalContextDtos.from(
                personalContextService.get(currentUserProvider.currentUserId())));
    }

    /** 保存当前用户显式维护的画像。 */
    @ApiLog("保存个人上下文画像")
    @PutMapping("/profile")
    public Result<Response> updateProfile(@RequestBody UpdateProfileRequest request) {
        return Result.success(PersonalContextDtos.from(personalContextService.save(
                currentUserProvider.currentUserId(), request == null ? null : request.profile())));
    }

    /** 开启或暂停画像与相关记忆自动注入。 */
    @ApiLog("更新个人上下文开关")
    @PutMapping("/enabled")
    public Result<Response> updateEnabled(@RequestBody UpdateEnabledRequest request) {
        if (request == null) throw new IllegalArgumentException("缺少个人上下文开关");
        return Result.success(PersonalContextDtos.from(personalContextService.setEnabled(
                currentUserProvider.currentUserId(), request.enabled())));
    }

    /** 清空显式画像，同时阻止旧画像回退。 */
    @ApiLog("清空个人上下文画像")
    @DeleteMapping("/profile")
    public Result<Response> clearProfile() {
        return Result.success(PersonalContextDtos.from(
                personalContextService.clear(currentUserProvider.currentUserId())));
    }
}
