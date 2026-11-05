export interface DevFlags {
  showcase: boolean;
}

/** 개발용 URL 플래그를 해석한다. 프로덕션(isDev=false)에서는 항상 꺼진다. */
export function parseDevFlags(search: string, isDev: boolean): DevFlags {
  return { showcase: isDev && new URLSearchParams(search).has("variants") };
}
