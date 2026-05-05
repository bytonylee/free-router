import { SITE_META, type Locale, isLocale } from "./content";
import { getElement, readStorage, writeStorage } from "./utils";

const en = {
  "hero.providers": "2 providers",
  "hero.lede":
    '<span class="lede-strong">Free model router for AI agents.</span><br />Route requests through the fastest free models, compare providers, and start building in seconds.',
  "hero.ctaRepo": "Read the README",
  "providers.label": "Providers",
  "providers.nim": "Edge-served inference endpoints with sub-200ms latency for the leading open models.",
  "providers.or": "Aggregated free tiers across dozens of model labs through one OpenAI-compatible API.",
  "why.label": "Why free-router",
  "why.sub": "Free models change weekly. The router stays current so your agents don't break.",
  "why.0": "Provider pings refresh every five seconds so you always reach the fastest free endpoint.",
  "why.1": "Models are ranked S+ to C by their public SWE-bench scores. Pick by capability, not name.",
  "why.2": "Single command writes the right config for OpenCode, OpenClaw, and friends.",
  "why.3": "<code>--best</code> flag returns the top free model id, ready to pipe into anything.",
  "install.label": "Install",
  "install.npxTitle": "CLI",
  "install.npxBody": "one-shot run via npx",
  "install.globalTitle": "Global",
  "install.globalBody": "pin to your machine",
  "usage.label": "Usage",
  "usage.pickTitle": "Open",
  "usage.pickBody": "pick a model and launch OpenCode",
  "usage.bestTitle": "Best model",
  "usage.bestBody": "print the top free model id",
  "models.label": "Models",
  "models.lede": "Every free model the router can reach right now, ranked by public benchmark signals.",
} as const;

type TranslationKey = keyof typeof en;
type TranslationMap = Record<TranslationKey, string>;

const ko = {
  "hero.providers": "2개 제공자",
  "hero.lede":
    '<span class="lede-strong">AI 에이전트를 위한 무료 모델 라우터.</span><br />가장 빠른 무료 모델로 요청을 라우팅하고, 제공자를 비교하며, 몇 초 만에 빌드를 시작하세요.',
  "hero.ctaRepo": "README 읽기",
  "providers.label": "제공자",
  "providers.nim": "주요 오픈 모델을 200ms 이하 지연으로 서빙하는 엣지 추론 엔드포인트.",
  "providers.or": "수십 개 모델 연구소의 무료 티어를 하나의 OpenAI 호환 API로 통합.",
  "why.label": "왜 free-router 인가",
  "why.sub": "안타깝게도 무료 모델은 영원하지 않습니다.<br />대신 free-router 가 항상 최신 상태를 유지해 사용에 문제가 없도록 합니다.",
  "why.0": "5초마다 제공자 핑을 갱신해 항상 가장 빠른 무료 엔드포인트에 닿습니다.",
  "why.1": "공개 SWE-bench 점수로 S+부터 C까지 등급을 매겨, 이름이 아닌 성능으로 고릅니다.",
  "why.2": "한 줄 커맨드로 OpenCode, OpenClaw 등에 맞는 설정 파일을 생성합니다.",
  "why.3": "<code>--best</code> 플래그가 최상위 무료 모델 ID를 반환해 어디든 파이프 가능합니다.",
  "install.label": "설치",
  "install.npxTitle": "CLI",
  "install.npxBody": "npx로 한 줄 실행",
  "install.globalTitle": "전역",
  "install.globalBody": "내 머신에 고정 설치",
  "usage.label": "사용법",
  "usage.pickTitle": "실행",
  "usage.pickBody": "모델을 고르고 OpenCode 실행",
  "usage.bestTitle": "최고 모델",
  "usage.bestBody": "최상위 무료 모델 ID 출력",
  "models.label": "모델",
  "models.lede": "라우터가 지금 닿을 수 있는 모든 무료 모델. 공개 벤치마크 점수로 정렬했습니다.",
} satisfies TranslationMap;

const I18N: Record<Locale, TranslationMap> = { en, ko };

function isTranslationKey(value: string | undefined): value is TranslationKey {
  return value !== undefined && value in en;
}

function getInitialLocale(): Locale {
  const stored = readStorage(SITE_META.localeKey);
  return isLocale(stored) ? stored : "en";
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (isTranslationKey(key)) element.innerHTML = I18N[locale][key];
  });
  document.querySelectorAll<HTMLElement>("[data-lang-en]").forEach((el) => (el.hidden = locale !== "en"));
  document.querySelectorAll<HTMLElement>("[data-lang-ko]").forEach((el) => (el.hidden = locale !== "ko"));
  writeStorage(SITE_META.localeKey, locale);
}

export function initLocale() {
  let locale = getInitialLocale();
  applyLocale(locale);

  getElement<HTMLButtonElement>("lang-toggle")?.addEventListener("click", () => {
    locale = document.documentElement.lang === "ko" ? "en" : "ko";
    applyLocale(locale);
  });
}
