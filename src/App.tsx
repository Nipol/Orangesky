import { useState, useEffect, useRef } from 'react'

import './App.css'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeProvider } from "@/components/theme-provider"
import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { Agent } from '@atproto/api'
import { Loader2Icon } from "lucide-react"
import type { AppBskyActorDefs, AppBskyActorGetPreferences } from '@atproto/api'

type MutedWordItem = AppBskyActorDefs.MutedWord

async function subscribeBlockList(agent: any, listAtUri: string) {
  await agent.blockModList(listAtUri)
}

async function addMutedWords(agent: any) {
  const list: string[] = ["섹블","섹트","자위","딸감","NSFW","リフレ","メンズエ","ソープ","どえむ","S男","M男","ドM","ドS","ご主人様","肉便器","オフパコ","調教","破滅願望","능욕","羞恥","뒷계","裏垢","보추","오토코노코","여장","cd","야방","도태남","성향계","도미넌트","서브미스","조교플레이","노예플레이","가축","핀섭","핀돔","FD","페티쉬","출장","시디","부커","부커만남","왁싱","ntr","부부만남","펨돔","성향자","쉬멜","관클","건오","야단라","야단텔","댈구","그리드홈","가슴","정액","신음","초대남","초대녀","네토","네토만남","비떱","BBW","상납","뚱녀","몸평","일탈","지인능욕","지인박제","지인상납","지인얼싸","근친","박제","지인ㅈ올","ㅈ올","얼싸","걸레","사정관리","변녀","암캐","조련","남존여비","박제","협박플","좆집","온플","야노","암퇘지","수치플","광대플","디그레이디","마조","유부녀","게단라","게단텔","영교","영딸","오프","초대","대물","갱뱅","커플만남","커닐","커닐드","커닐링","스왑","스와핑","섹파","FWB","오르가즘","바텀","탑","게이","고딩게이","중딩게이","초딩게이","대전게이","부산게이","파이즈리","슬레이브","스팽","빈유","창녀","입싸","보평","꼬평","맘눌뎀","변남","영섹","폰섹","풋잡","발정","신상상납","게이노예","경기게이","대전게이","부산게이","서울게이","청주게이","멜돔","멜섭","11게이","10게이","09게이","08게이","슬림돔","슬림게이","뚱게이","통게이","뚱통게이","뚱통섭","온플섭","오프섭","naughty","nudes","boobs","게친소","뜨밤","관전남","관전녀","걸레보지","부커모임","개보지","난교","질싸","질내사정","쓰리썸","게이알바"]
  const words = list.map(v => ({
    value: v,
    targets: ['both'], // 'both' 대신 content+tag
    actorTarget: 'all'
  }))

  const cur = await agent.app.bsky.actor.getPreferences() as AppBskyActorGetPreferences.Response

  // 기존의 mutedWordsPref 찾기
  const prefs = cur.data.preferences ?? []
  const idx = prefs.findIndex(p => p.$type === 'app.bsky.actor.defs#mutedWordsPref')

  const dedupKey = (w: MutedWordItem) => `${w.value.toLowerCase()}::${[...(w.targets ?? [])].sort().join(',')}`
  const existing = new Set<string>()

  let items: MutedWordItem[] = []
  if (idx >= 0) {
    const mw = prefs[idx] as any
    items = (mw.items ?? []) as MutedWordItem[]
    items.forEach(w => existing.add(dedupKey(w)))
  }

  // 병합(중복 제거)
  for (const w of words) {
    const k = dedupKey(w)
    if (!existing.has(k)) {
      items.push(w)
      existing.add(k)
    }
  }

  const nextPref = {
    $type: 'app.bsky.actor.defs#mutedWordsPref',
    items,
  }

  // putPreferences는 전체 배열을 보낸다. 안전하게 다른 항목도 포함해서 전달
  const next = idx >= 0 ? [...prefs.slice(0, idx), nextPref, ...prefs.slice(idx + 1)] : [...prefs, nextPref]
  await agent.app.bsky.actor.putPreferences({ preferences: next })
}


function App() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [muteStatus, setMuteStatus] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult1Status, setBlockAdult1Status] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult2Status, setBlockAdult2Status] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult3Status, setBlockAdult3Status] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult4Status, setBlockAdult4Status] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult5Status, setBlockAdult5Status] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult6Status, setBlockAdult6Status] = useState<"idle" | "loading" | "done">("idle")
  const [blockAdult7Status, setBlockAdult7Status] = useState<"idle" | "loading" | "done">("idle")

  // 로그인 폼
  const [handleOrDidOrPds, setHandle] = useState("")

  // OAuth 클라이언트 & 에러
  const clientRef = useRef<BrowserOAuthClient | null>(null)
  const agentRef = useRef<Agent | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [sessionDid, setSessionDid] = useState<string | null>(null)

  // 1) OAuth 클라이언트: 앱 로드시 딱 한 번 준비
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const client = new BrowserOAuthClient({
          clientMetadata: {
            "client_id": "https://orangesky.pages.dev/client-metadata.json",
            "client_name": "Orangesky",
            "client_uri": "https://orangesky.pages.dev",
            "logo_uri": "https://orangesky.pages.dev/logo.png",
            "tos_uri": "https://orangesky.pages.dev/tos",
            "policy_uri": "https://orangesky.pages.dev/policy",
            "redirect_uris": ["https://orangesky.pages.dev/callback"],
            "scope": "atproto transition:generic",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
            "application_type": "web",
            "dpop_bound_access_tokens": true
          },
          handleResolver: "https://bsky.social",
        })

        // 콜백/세션 복원 처리. 실패를 catch해야 렌더가 안죽음
        const result = await client.init()

        if (!cancelled && result?.session) {
          const { session } = result
          // OAuth 세션에서 Agent 생성
          const makedagent = new Agent(session)
          agentRef.current = makedagent
          setSessionDid(session.sub) // 사용자의 DID
        }

        if (!cancelled) {
          clientRef.current = client
        }
      } catch (e: any) {
        if (!cancelled) setOauthError(e?.message ?? String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])


  useEffect(() => {
    if (!api) {
      return
    }
 
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)
 
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })

  }, [api])

  const login = async () => {
    const client = clientRef.current;
    if (!client) throw new Error("OAuth client not ready");
    await client.signInPopup(handleOrDidOrPds.trim()); // 예: "alice.bsky.social"
    window.location.reload();
  }

  const logout = async () => {
    localStorage.removeItem("@@atproto/oauth-client-browser(sub)");
    window.location.reload();
  }

  // 차단 단어 추가 버튼
  const addWords = async () => {
    
    try {
      setMuteStatus("loading")
      await addMutedWords(agentRef.current)
      setMuteStatus("done")
    } catch (e) {
      console.error(e)
      setMuteStatus("idle") // 실패 시 다시 초기 상태
    }
  }

  // Mutelist 구독 버튼
  const subBlocklist1 = async () => {
    try {
      setBlockAdult1Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:acfdzk5s5siwp3zvwgrwosw3/app.bsky.graph.list/3lqykacry672s")
      setBlockAdult1Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult1Status("idle") // 실패 시 다시 초기 상태
    }
  }

  const subBlocklist2 = async () => {
    try {
      setBlockAdult2Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:2sjfdilgcpeyjnqo7u6apdfn/app.bsky.graph.list/3lgnquwraja2m")
      setBlockAdult2Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult2Status("idle") // 실패 시 다시 초기 상태
    }
  }

  const subBlocklist3 = async () => {
    try {
      setBlockAdult3Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:o32czr4lvcqem4bgwlhpwpdk/app.bsky.graph.list/3lgdlcchfgk2v")
      setBlockAdult3Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult3Status("idle") // 실패 시 다시 초기 상태
    }
  }

  const subBlocklist4 = async () => {
    try {
      setBlockAdult4Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:ujd4psl3bnn6iwel6devrupx/app.bsky.graph.list/3l5seet2a672k")
      setBlockAdult4Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult4Status("idle") // 실패 시 다시 초기 상태
    }
  }

  const subBlocklist5 = async () => {
    try {
      setBlockAdult5Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:zwdyfhrdvvalbiuekbok7loj/app.bsky.graph.list/3l5vojg44nc23")
      setBlockAdult5Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult5Status("idle") // 실패 시 다시 초기 상태
    }
  }

  const subBlocklist6 = async () => {
    try {
      setBlockAdult6Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:jfv3j2y25xqou4vembrqry6j/app.bsky.graph.list/3l6bqmhh7px2c")
      setBlockAdult6Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult6Status("idle") // 실패 시 다시 초기 상태
    }
  }

  const subBlocklist7 = async () => {
    try {
      setBlockAdult7Status("loading")
      await subscribeBlockList(agentRef.current, "at://did:plc:hxgsjcburk6mkav5siqdm55d/app.bsky.graph.list/3l5obdzzma32n")
      setBlockAdult7Status("done")
    } catch (e) {
      console.error(e)
      setBlockAdult7Status("idle") // 실패 시 다시 초기 상태
    }
  }

  // UI에서 오류를 명시적으로 드러내기(에러 바운더리 대신 최소 처리)
  if (oauthError) {
    return <div style={{ padding: 16 }}>
      <h2>OAuth 초기화 실패</h2>
      <pre>{oauthError}</pre>
      <p>HTTPS/인증서/콘솔 네트워크 로그를 먼저 확인하세요.</p>
    </div>
  }

  return (
   <>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <nav className="relative bg-gray-800">
      </nav>
      <div className="container mx-auto min-h-screen grid grid-cols-1 md:grid-cols-2 items-center gap-8 p-6">
        <div>
          {
            sessionDid
            ? 
            <>
              <Card className="w-full max-w-sm mx-auto mb-2 ">
                <CardHeader>
                  <CardTitle>자주 사용되는 유해 단어 추가</CardTitle>
                  <CardDescription>
                    성인용 계정이 자주 사용하는 단어를 한 번에 추가합니다.
                  </CardDescription>
                  <CardContent>
                    <Button variant="outline" className="w-full font-semibold" onClick={addWords} disabled={muteStatus === "loading" || muteStatus === "done"}>
                      {muteStatus === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                      {muteStatus === "idle" && "차단 단어 추가"}
                      {muteStatus === "loading" && "처리 중..."}
                      {muteStatus === "done" && "차단 완료"}
                    </Button>
                  </CardContent>
                </CardHeader>
              </Card>
              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>성인물 계정 및 팔로워 검토 리스트</CardTitle>
                  <CardDescription>
                    이 리스트의 구독은 알고리즘의 분리 목적으로 만들어진 것으로, 성인물 제작자와 그 팔로워들을 모두 차단합니다.<br/>
                    @yoonseul.bsky.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:acfdzk5s5siwp3zvwgrwosw3/lists/3lqykacry672s" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist1} disabled={blockAdult1Status === "loading" || blockAdult1Status === "done"}>
                    {blockAdult1Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult1Status === "idle" && "차단"}
                    {blockAdult1Status === "loading" && "처리 중..."}
                    {blockAdult1Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>한국인 색계 검토 리스트</CardTitle>
                  <CardDescription>
                    섹계에게 많이 당해본 트랜스여성이 직접 모읍니다<br/>다른 리스트에 없는 사람들도 있을 수 있으니 병용하세요.<br/>
                    @flyingaubrey.bsky.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:2sjfdilgcpeyjnqo7u6apdfn/lists/3lgnquwraja2m" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist2} disabled={blockAdult2Status === "loading" || blockAdult2Status === "done"}>
                    {blockAdult2Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult2Status === "idle" && "차단"}
                    {blockAdult2Status === "loading" && "처리 중..."}
                    {blockAdult2Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>안구 보호 검토 리스트</CardTitle>
                  <CardDescription>
                    헐벗은 육체나 생식기 등을 게시하는 성적 활동 계정 리스트.<br/>
                    @xmrnoyoo.bsky.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:o32czr4lvcqem4bgwlhpwpdk/lists/3lgdlcchfgk2v" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist3} disabled={blockAdult3Status === "loading" || blockAdult3Status === "done"}>
                    {blockAdult3Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult3Status === "idle" && "차단"}
                    {blockAdult3Status === "loading" && "처리 중..."}
                    {blockAdult3Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>
            
              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>성적 게시물 차단용</CardTitle>
                  <CardDescription>
                    성적 활동을 위해 포스트하거나 답글을 다는 계정들(이른바 '섹계')을 모은 리스트입니다.<br/>
                    @last-night.bsky.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:ujd4psl3bnn6iwel6devrupx/lists/3l5seet2a672k" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist4} disabled={blockAdult4Status === "loading" || blockAdult4Status === "done"}>
                    {blockAdult4Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult4Status === "idle" && "차단"}
                    {blockAdult4Status === "loading" && "처리 중..."}
                    {blockAdult4Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>19+ 계정 검토 리스트</CardTitle>
                  <CardDescription>
                    블루스카이의 자체 성인물 필터와 한국어 모더레이션 서비스 '그늘' 필터링에 걸리지 않은 계정을 잡아넣는 검토 리스트입니다. <br/>
                    @ericht.kawaii.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:zwdyfhrdvvalbiuekbok7loj/lists/3l5vojg44nc23" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist5} disabled={blockAdult5Status === "loading" || blockAdult5Status === "done"}>
                    {blockAdult5Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult5Status === "idle" && "차단"}
                    {blockAdult5Status === "loading" && "처리 중..."}
                    {blockAdult5Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>속옷을 잘 입어요</CardTitle>
                  <CardDescription>
                    @ojo82.bsky.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:jfv3j2y25xqou4vembrqry6j/lists/3l6bqmhh7px2c" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist6} disabled={blockAdult6Status === "loading" || blockAdult6Status === "done"}>
                    {blockAdult6Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult6Status === "idle" && "차단"}
                    {blockAdult6Status === "loading" && "처리 중..."}
                    {blockAdult6Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="w-full max-w-sm mx-auto mb-4 ">
                <CardHeader>
                  <CardTitle>차단 계정</CardTitle>
                  <CardDescription>
                    성인 어쩌고. 커플 어쩌고<br/>
                    @bsky-tip.bsky.social 님의 검토 리스트
                  </CardDescription>
                  <CardAction>
                    <Button variant="link" asChild>
                      <a href="https://bsky.app/profile/did:plc:hxgsjcburk6mkav5siqdm55d/lists/3l5obdzzma32n" target="_blank">목록</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full font-semibold" onClick={subBlocklist7} disabled={blockAdult7Status === "loading" || blockAdult7Status === "done"}>
                    {blockAdult7Status === "loading" && <Loader2Icon className="animate-spin mr-2" />}
                    {blockAdult7Status === "idle" && "차단"}
                    {blockAdult7Status === "loading" && "처리 중..."}
                    {blockAdult7Status === "done" && "차단 완료"}
                  </Button>
                </CardContent>
              </Card>
              
              <div className='w-full max-w-sm mx-auto'>
                <Button variant="outline" className="w-full max-w-sm mx-auto mt-2 mb-2 font-semibold" onClick={logout}>
                  로그아웃
                </Button>
              </div>
            </>
            : 
            <Card className="w-full max-w-sm mx-auto">
            <CardHeader>
              <CardTitle>OrangeSky🍊</CardTitle>
              <CardDescription>
                블루스카이 핸들을 입력하여 해당 웹페이지에 권한을 부여하세요. 블루스카이 로그인 창이 팝업으로 뜨게 됩니다. 이러한 종류의 웹페이지에 로그인 할 때에는 입력되는 주소가 꼭 bsky.social인지 확인하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">블루스카이 핸들</Label>
                  <Input
                    id="handle"
                    type="text"
                    placeholder="yoonseul.bsky.social"
                    value={handleOrDidOrPds}
                    onChange={(e) => setHandle(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={login}>
                이 사이트에 권한 할당
              </Button>
            </CardFooter>
          </Card>
          }
        </div>
        <div>
          <Carousel className="w-full max-w-sm mx-auto" setApi={setApi}>
            <CarouselContent>
              <CarouselItem>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex aspect-4/3 items-center justify-center p-6">
                      <span className="text-2xl font-semibold">블루스카이🌱는 공개형 소셜미디어로써, 알고리즘과 큐레이션이 노출도에 비례하여 일괄적으로 추천됩니다. <br/><br/>이 과정에서 의도치 않은 성인물이 노출되는 경우가 있습니다.</span>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>

              <CarouselItem>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex aspect-4/3 items-center justify-center p-6">
                      <span className="text-2xl font-semibold">OrangeSky🍊는 이런 포스트가 노출되지 않도록 다양한 차단 단어를 등록하고, 알려진 성인물 계정 및 스팸 계정을 차단하는데 도움을 줍니다.</span>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>

              <CarouselItem>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex aspect-4/3 items-center justify-center p-6">
                      <span className="text-2xl font-semibold">OrangeSky🍊는 OAuth를 이용하여 사용자 계정 접근 권한을 얻어야 작동합니다. <br/><br/>해당 웹페이지가 취득하는 정보는 서버로 전송되지 않고, 웹페이지 내에서 동작하고 삭제됩니다.</span>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>

              <CarouselItem>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex aspect-4/3 items-center justify-center p-6">
                      <span className="text-2xl font-semibold">로그인 중인 사이트가 `bsky.social`인지 꼭 확인하시고, 작업이 끝나면 해당 사이트에서 로그아웃을 수행하세요.</span>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
          <div className="text-muted-foreground py-2 text-center text-sm">
            Slide {current} of {count}
          </div>
        </div>
      </div>
    </ThemeProvider>
    </>
  )
}

export default App
