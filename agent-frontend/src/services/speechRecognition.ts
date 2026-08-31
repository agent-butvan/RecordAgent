/** 浏览器内置语音识别的轻量适配，避免页面直接依赖厂商前缀 API。 */
export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export const isSpeechRecognitionSupported = () => Boolean(
  window.SpeechRecognition || window.webkitSpeechRecognition,
);

/**
 * 主动向系统申请麦克风权限。
 * Web Speech API 的授权行为在各 WebView 中不一致，因此必须先走标准媒体权限流程。
 */
export const requestMicrophoneAccess = async (): Promise<void> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前桌面环境不支持麦克风访问。');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
      throw new Error('麦克风权限未开启，请在系统设置中允许 ButvanAgent 使用麦克风。');
    }
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new Error('未检测到可用麦克风。');
    }
    throw new Error('无法访问麦克风，请检查设备后重试。');
  }
};

interface CreateSpeechRecognitionOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

const errorMessages: Record<string, string> = {
  'not-allowed': '麦克风权限未开启，请在系统设置中允许使用麦克风。',
  'service-not-allowed': '系统未允许语音识别服务。',
  'audio-capture': '未检测到可用麦克风。',
  network: '语音识别服务连接失败，请检查网络后重试。',
  'no-speech': '未检测到语音，请再试一次。',
  aborted: '',
};

/** 创建一次听写会话；识别结果通过回调实时返回。 */
export const createSpeechRecognition = ({
  onTranscript,
  onError,
  onEnd,
}: CreateSpeechRecognitionOptions): SpeechRecognitionController | null => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interimText += result[0].transcript;
      }
    }
    if (finalText) onTranscript(finalText, true);
    if (interimText) onTranscript(interimText, false);
  };
  recognition.onerror = (event) => {
    const message = errorMessages[event.error] ?? '语音识别失败，请重试。';
    if (message) onError(message);
  };
  recognition.onend = onEnd;

  return recognition;
};
