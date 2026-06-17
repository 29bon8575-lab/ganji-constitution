// ════════════════════════════════════════════════════════════════════════
//  干支體質論 체질감별 엔진 (서버 전용 · IP 은닉)
//  ─ 이 파일은 Vercel 서버에서만 실행됩니다. 브라우저로 전송되지 않습니다.
//  ─ 알고리즘 출처: 황교헌 원장 干支體質論 (신라한의원)
//  ─ 천문 계산: Jean Meeus 알고리즘 기반, KST 보정
// ════════════════════════════════════════════════════════════════════════

const heavenlyStems   = ['갑','을','병','정','무','기','경','신','임','계'];
const earthlyBranches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];

const stemHanja = {
  '갑':'甲','을':'乙','병':'丙','정':'丁','무':'戊',
  '기':'己','경':'庚','신':'辛','임':'壬','계':'癸'
};
const branchHanja = {
  '자':'子','축':'丑','인':'寅','묘':'卯','진':'辰','사':'巳',
  '오':'午','미':'未','신':'申','유':'酉','술':'戌','해':'亥'
};

const stemElement = {
  '갑':'목','을':'목','병':'화','정':'화','무':'토',
  '기':'토','경':'금','신':'금','임':'수','계':'수'
};

// ⭐ 미·술은 相火(상화) → 화로 처리
const branchElement = {
  '자':'수','축':'토','인':'목','묘':'목','진':'토','사':'화',
  '오':'화','미':'화','신':'금','유':'금','술':'화','해':'수'
};

// ─── 천문 계산 (Jean Meeus 기반, KST) ──────────────────────────────────────
const _R = Math.PI / 180;

const g2jd = (y, m, d) => {
  if (m <= 2) { y--; m += 12; }
  const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5;
};

const jd2g = jd => {
  const z = Math.floor(jd + 0.5);
  const al = Math.floor((z - 1867216.25)/36524.25);
  const a  = z >= 2299161 ? z + 1 + al - Math.floor(al/4) : z;
  const b  = a + 1524, c = Math.floor((b - 122.1)/365.25);
  const d  = Math.floor(365.25*c), e = Math.floor((b - d)/30.6001);
  const day   = b - d - Math.floor(30.6001*e);
  const month = e < 14 ? e - 1 : e - 13;
  return { year: month > 2 ? c - 4716 : c - 4715, month, day };
};

const _newMoon = k => {
  const T = k/1236.85, T2 = T*T, T3 = T2*T;
  let j = 2451550.09766 + 29.530588861*k + 0.00015437*T2 - 0.00000015*T3;
  const M  = _R*(2.5534   + 29.10535669*k  - 0.0000218*T2);
  const M1 = _R*(201.5643 + 385.81693528*k + 0.0107438*T2);
  const F  = _R*(160.7108 + 390.67050274*k - 0.0016341*T2);
  const O  = _R*(124.7746 - 1.56375580*k   + 0.0020691*T2);
  j += -.40720*Math.sin(M1) + .17241*Math.sin(M)  + .01608*Math.sin(2*M1)
     + .01039*Math.sin(2*F) + .00739*Math.sin(M1-M) - .00514*Math.sin(M1+M)
     + .00208*Math.sin(2*M) - .00111*Math.sin(M1-2*F) - .00057*Math.sin(M1+2*F)
     + .00056*Math.sin(2*M1+M) - .00042*Math.sin(3*M1) + .00042*Math.sin(M+2*F)
     + .00038*Math.sin(M-2*F) - .00024*Math.sin(2*M1-M) - .00017*Math.sin(O);
  return j + 9/24; // KST 보정
};

// KST 자정 기준 새달 정수일
const _newMoonDay = k => Math.floor(_newMoon(k) + 0.5);

const _kFor = jd => {
  let k = Math.round((jd - 2451550.09766)/29.530588861);
  while (_newMoonDay(k)   > Math.floor(jd + 0.5)) k--;
  while (_newMoonDay(k+1) <= Math.floor(jd + 0.5)) k++;
  return k;
};

const _sunLon = jd => {
  const T = (jd - 9/24 - 2451545)/36525, T2 = T*T;
  let L = 280.46646 + 36000.76983*T + 0.0003032*T2;
  const M = _R*(357.52911 + 35999.05029*T - 0.0001537*T2);
  L += (1.914602 - .004817*T - .000014*T2)*Math.sin(M)
     + (.019993  - .000101*T)*Math.sin(2*M)
     + .000289*Math.sin(3*M)
     - 0.00569 - 0.00478*Math.sin(_R*(125.04 - 1934.136*T));
  return ((L % 360) + 360) % 360;
};

const _findSunLon = (targetLon, startJD) => {
  let jd = startJD;
  for (let i = 0; i < 50; i++) {
    const delta = ((targetLon - _sunLon(jd) + 540) % 360) - 180;
    jd += delta/360 * 365.25;
    if (Math.abs(delta) < 0.0001) break;
  }
  return jd;
};

const _getZhongqi = k => {
  const ls = _sunLon(_newMoon(k)), le = _sunLon(_newMoon(k+1));
  const n1 = Math.floor(ls/30);
  const n2 = le >= ls ? Math.floor(le/30) : Math.floor(le/30) + 12;
  return n2 > n1 ? ((n1+1)*30) % 360 : -1;
};

// 음력 11/12월 연도 해석 (정통 음력 표기법)
const _findMonthK = (lunarYear, lunarMonth) => {
  const zqLon = lunarMonth === 1 ? 330 : (lunarMonth - 2)*30;
  let gYear = lunarYear, gMonth;
  if      (lunarMonth === 11) { gMonth = 12; }
  else if (lunarMonth === 12) { gYear = lunarYear + 1; gMonth = 1; }
  else                        { gMonth = lunarMonth + 1; }
  const zqJD = _findSunLon(zqLon, g2jd(gYear, gMonth, 15) - 30);
  return _kFor(zqJD);
};

const lunarToGreg = (ly, lm, ld, isLeap) => {
  try {
    const k = _findMonthK(ly, lm);
    let targetK = k;
    if (isLeap) {
      if (_getZhongqi(k+1) === -1) targetK = k + 1;
      else return null;
    }
    const days = Math.round(_newMoon(targetK+1) - _newMoon(targetK));
    if (ld < 1 || ld > days) return null;
    return jd2g(_newMoonDay(targetK) + ld - 1);
  } catch { return null; }
};

// ─── 절기 데이터 ──────────────────────────────────────────────────────────
const JIEQI = [
  { lon: 315, idx: 2,  name: '입춘' },
  { lon: 345, idx: 3,  name: '경칩' },
  { lon: 15,  idx: 4,  name: '청명' },
  { lon: 45,  idx: 5,  name: '입하' },
  { lon: 75,  idx: 6,  name: '망종' },
  { lon: 105, idx: 7,  name: '소서' },
  { lon: 135, idx: 8,  name: '입추' },
  { lon: 165, idx: 9,  name: '백로' },
  { lon: 195, idx: 10, name: '한로' },
  { lon: 225, idx: 11, name: '입동' },
  { lon: 255, idx: 0,  name: '대설' },
  { lon: 285, idx: 1,  name: '소한' },
];

const _getIpchunJD = year => _findSunLon(315, g2jd(year, 1, 15) - 30);

const _getEffectiveYear = (year, month, day) => {
  const birthJD = g2jd(year, month, day);
  const ipchunJD = _getIpchunJD(year);
  return birthJD < ipchunJD ? year - 1 : year;
};

const _getIpchunDate = year => jd2g(_getIpchunJD(year));

// ── 복희역(伏羲易): 동지(冬至, 황경 270°)를 새해 기점으로 보는 관점 ──
//   통용 사주는 입춘(立春)을 새해로 보지만, 복희역은 동지를 기점으로 한다.
//   생일이 [전년 동지 ~ 당해 입춘) 구간이면 통용 년주와 복희역 년주가 달라진다.
const _getDongjiJD = year => _findSunLon(270, g2jd(year, 12, 1) - 5);  // 당해 12월 동지
const _getDongjiDate = year => jd2g(_getDongjiJD(year));

// 복희역 기준 '유효 년도' 산출 (동지 기점)
//   동지 당일 출생 = 당년 귀속 (생시 미사용)
const _getBokhuiYear = (year, month, day) => {
  const birthJD = g2jd(year, month, day);
  const dongjiThis = _getDongjiJD(year);       // 당해 동지 (≈12/22)
  if (birthJD >= dongjiThis) return year + 1;   // 당해 동지 이후 = 복희역상 다음해
  const dongjiPrev = _getDongjiJD(year - 1);    // 전년 동지
  if (birthJD >= dongjiPrev) return year;        // 전년 동지~당해 동지 전 = 복희역상 당해
  return year - 1;
};

const getMonthBranchByJieqi = (year, month, day) => {
  const jd = g2jd(year, month, day);
  const curLon = _sunLon(jd);

  const lonShifted = ((curLon - 15) % 360 + 360) % 360;
  let lastLon = (Math.floor(lonShifted/30) * 30 + 15) % 360;

  let lastJD = _findSunLon(lastLon, jd - 60);
  if (lastJD > jd + 0.5) {
    lastLon = (lastLon - 30 + 360) % 360;
    lastJD = _findSunLon(lastLon, jd - 90);
  }

  const nextLon = (lastLon + 30) % 360;
  const nextJD  = _findSunLon(nextLon, lastJD + 15);

  const cur  = JIEQI.find(j => j.lon === lastLon);
  const next = JIEQI.find(j => j.lon === nextLon);

  return {
    branchIdx: cur.idx,
    branch:    earthlyBranches[cur.idx],
    jieqi:     cur.name,
    jieqiDate: jd2g(lastJD),
    nextJieqi: next.name,
    nextDate:  jd2g(nextJD),
  };
};

// ─── 간지 계산 ────────────────────────────────────────────────────────────
const _yearGanjiOf = effYear => {
  const baseYear = 1984; // 갑자년
  const si = ((effYear - baseYear) % 10 + 10) % 10;
  const bi = ((effYear - baseYear) % 12 + 12) % 12;
  return { stem: heavenlyStems[si], branch: earthlyBranches[bi] };
};

const _calcMonthGanji = (year, month, day, yearStem) => {
  const jieqi = getMonthBranchByJieqi(year, month, day);
  const ySI = heavenlyStems.indexOf(yearStem);
  const monthNum = ((jieqi.branchIdx - 2 + 12) % 12) + 1;
  const monthStemStart = (ySI % 5) * 2 + 2;
  const stemIndex = (monthStemStart + monthNum - 1) % 10;
  return {
    stem: heavenlyStems[stemIndex],
    branch: jieqi.branch,
    _jieqi: jieqi,
  };
};

const _calcDayGanji = (year, month, day) => {
  const baseDate   = new Date(Date.UTC(1900, 0, 1));
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const diffDays = Math.round((targetDate - baseDate) / 86400000);
  const stemIndex   = ((diffDays % 10) + 10) % 10;
  const branchIndex = ((diffDays + 10) % 12 + 12) % 12;
  return { stem: heavenlyStems[stemIndex], branch: earthlyBranches[branchIndex] };
};

// ════════════════════════════════════════════════════════════════════════
//  레이어 B — 체질 판별 정본 (v27, 2026-06-14 · 원전 8서열 직접 역공학)
//  입력 = 간지 6글자 [연간 연지 월간 월지 일간 일지]. 사상 4체질 + 1/2형.
//  3단계: ①진영(점수 和>火→양) ②체질(개수) ③1·2형(점수 2·3위 강약)
//  근거: 박용규『입체음양오행으로 풀이한 동양의학 혁명』p.181~183 8서열 강약공식
//  ※ 미·술=和(별도 원소). 집계 단계전환(점수→개수→점수)은 케이스 적합화로,
//    원전이 비운 구현 자유도이며 양진영 실데이터로 반증 가능(교차검증 A).
//    양진영 金=水 동률은 엄격부등호상 미정의 구간(교차검증 D, 검증 0건).
// ════════════════════════════════════════════════════════════════════════
const _v27_stemEl   = {갑:'木',을:'木',병:'火',정:'火',무:'土',기:'土',경:'金',신:'金',임:'水',계:'水'};
const _v27_branchEl = {자:'水',축:'土',인:'木',묘:'木',진:'土',사:'火',오:'火',미:'和',신:'金',유:'金',술:'和',해:'水'};

// ════════════════════════════════════════════════════════════════════════
//  v39 판정 엔진 (삼문게이트 진영판정 + 1·2형 AXIS) — 36/36 봉인 정본
//  ─ 진영판정: score(가중 W38) 기반 和>火 게이트 + 木土金水 우세소거
//  ─ 1·2형: dist(자리값 1·2·3) 기반 AXIS 두 축 강약비교
//  ─ 외부 인터페이스 _v27_diagnose(gz)→{sasang,form,label,s1,s2} 유지
// ════════════════════════════════════════════════════════════════════════

const _W38 = [2,4,3,5,4,6];   // score 가중 [연간 연지 월간 월지 일간 일지]
function _v39_score(gz){
  const sc={木:0,火:0,土:0,金:0,水:0,和:0};
  for(let i=0;i<6;i++){
    const ch=gz[i], el=(i%2===0)?_v27_stemEl[ch]:_v27_branchEl[ch];
    sc[el]+=_W38[i];
  }
  return sc;
}
const _v39_distW=[1,1,2,2,3,3];   // dist 자리값 (연1 월2 일3)
function _v39_dist(gz){
  const d={木:0,火:0,土:0,金:0,水:0,和:0};
  for(let i=0;i<6;i++){
    const ch=gz[i], el=(i%2===0)?_v27_stemEl[ch]:_v27_branchEl[ch];
    d[el]+=_v39_distW[i];
  }
  return d;
}
function _v39_cnt(gz){
  const c={木:0,火:0,土:0,金:0,水:0,和:0};
  for(let i=0;i<6;i++){
    const ch=gz[i], el=(i%2===0)?_v27_stemEl[ch]:_v27_branchEl[ch];
    c[el]++;
  }
  return c;
}

const _v39_AXIS={소양:['金','木'],태음:['土','水'],태양:['水','土'],소음:['木','金']};

// 진영(4상) — 삼문게이트
function _v39_four(sc){
  if(sc.和>sc.火){
    if(sc.金>sc.水) return '태양';
    if(sc.水>sc.金) return '소음';
    return (sc.木>0)?'소음':'태양';
  } else {
    const M=sc.木,T=sc.土,G=sc.金,Wt=sc.水;
    const boost=(M>0 && M>=G);
    let m2v;
    if(boost){ const g2=Math.max(G-Wt,0); m2v=Math.max(M-g2,0)+Wt; }
    else m2v=Math.max(M-G,0);
    if(m2v>T) return '태음';
    if(T>m2v) return '소양';
    return boost?'태음':(M>T?'태음':'소양');
  }
}
// 1·2형 — AXIS 두 축 강약 (둘다 0이면 2형)
function _v39_form(four, d){
  const [a,b]=_v39_AXIS[four];
  if(d[a]===0 && d[b]===0) return 2;
  return (d[a]>=d[b])?1:2;
}

// 진단 — 외부 시그니처 {sasang, form, label, s1, s2} 유지
function _v27_diagnose(gz){
  const sc  =_v39_score(gz);
  const dist=_v39_dist(gz);
  const cnt =_v39_cnt(gz);
  const sasang=_v39_four(sc);
  const form  =_v39_form(sasang, dist);
  const camp  =(sasang==='태양'||sasang==='소음')?'양':'음';
  const [ax,bx]=_v39_AXIS[sasang];
  const detail=`진영 ${camp}(和${sc.和}/火${sc.火}) · ${sasang} · ${form}형(${ax}${dist[ax]}/${bx}${dist[bx]})`;
  return {
    sasang, form, label:`${sasang}${form}`,
    s1:{cnt, dist, camp, best:sasang, sasang},
    s2:{form, detail, dist, grade:null, sanghan:null, pick:null},
  };
}

// ── 형 ↔ 권도원 8체질 매핑 (확정: 1형=음, 2형=양) ──
//   태양1=금음 태양2=금양 / 소양1=토음 소양2=토양
//   태음1=목음 태음2=목양 / 소음1=수음 소음2=수양
const _FORM2KWON = {
  '태양1':'금음','태양2':'금양','소양1':'토음','소양2':'토양',
  '태음1':'목음','태음2':'목양','소음1':'수음','소음2':'수양',
};
const _SASANG_FULL = { 태양:'태양인', 소양:'소양인', 태음:'태음인', 소음:'소음인' };

// [v40 변경] 표시 래퍼 — 결정론 판정이므로 "우세" 제거, 세부형은 로마숫자(Ⅰ/Ⅱ).
function _displayLabel(sasangKo, form){
  if(form==null) return sasangKo+' (형 미정)';
  const roman = (form===1) ? 'Ⅰ' : (form===2) ? 'Ⅱ' : String(form);
  return sasangKo+' ('+roman+'형)';
}

// ── 어댑터: 배포본 간지객체 → v25 6글자 배열 → 판정 결과 패키지 ──
//   순서 고정: 연간 연지 월간 월지 일간 일지
const _determineConstitution = g => {
  const gz = [
    g.year.stem,  g.year.branch,
    g.month.stem, g.month.branch,
    g.day.stem,   g.day.branch,
  ];
  const d = _v27_diagnose(gz);
  const sasangKo = _SASANG_FULL[d.sasang];          // '소양인'
  const formNum  = d.form;                           // 1 | 2
  const formKey  = `${d.sasang}${d.form}`;           // '소양2'
  const kwon     = _FORM2KWON[formKey] || null;      // '토양'
  return {
    result:   sasangKo,                              // 사상 (4체질) — 기존 호환
    sasang:   d.sasang,                              // '소양'
    form:     formNum,                               // 1|2
    formLabel:`${sasangKo} ${formNum}\ud615`,         // '소양인 2형' (내부/간략)
    displayLabel: _displayLabel(sasangKo, formNum),   // '소양인 (Ⅱ형)' (화면 노출용)
    kwon,                                            // '토양'
    kwonLabel: kwon ? `${kwon}\uccb4\uc9c8` : null,    // '토양체질'
    foodKey:  formKey,                                // guidance-data 8체질 키 '소양2'
    trace: { s1:d.s1, s2:d.s2,
             cnt:d.s1.cnt, camp:d.s1.camp, best:d.s1.best,
             detail:d.s2.detail, grade:d.s2.grade, sanghan:d.s2.sanghan, pick:d.s2.pick },
    note: `${d.s1.camp}\uc9c4\uc601 \u00b7 \ucd5c\uac15 ${d.s1.best} \u00b7 ${d.s2.detail}`,
  };
};

// ─── 통합 분석 (입춘 기준 단일 + 복희역 동지 병기) ───────────────────────
const _analyzeBoth = (year, month, day) => {
  const yY_ip = _getEffectiveYear(year, month, day);
  const yearG_ip = _yearGanjiOf(yY_ip);
  const monthG_ip = _calcMonthGanji(year, month, day, yearG_ip.stem);
  const dayG = _calcDayGanji(year, month, day);

  const ganji_ip = {
    year: yearG_ip,
    month: { stem: monthG_ip.stem, branch: monthG_ip.branch },
    day: dayG
  };
  const r_ip = _determineConstitution(ganji_ip);

  // ── 복희역(동지 기점) 재판정 ──
  //   복희역 유효년도로 년주를 다시 세워 체질을 재판정한다.
  //   통용(입춘) 유효년도와 복희역 유효년도가 다를 때만 의미가 있다.
  const yY_bok = _getBokhuiYear(year, month, day);
  let bokhui = null;
  const bokhuiDiffers = (yY_bok !== yY_ip);
  if (bokhuiDiffers) {
    const yearG_bok  = _yearGanjiOf(yY_bok);
    const monthG_bok = _calcMonthGanji(year, month, day, yearG_bok.stem);
    const ganji_bok = {
      year: yearG_bok,
      month: { stem: monthG_bok.stem, branch: monthG_bok.branch },
      day: dayG
    };
    const r_bok = _determineConstitution(ganji_bok);
    bokhui = {
      ganji: ganji_bok,
      constitution: r_bok,
      effectiveYear: yY_bok,
      differs: (r_bok.result !== r_ip.result) || (r_bok.formLabel !== r_ip.formLabel),
    };
  }

  return {
    primary:   { ganji: ganji_ip,  constitution: r_ip,  effectiveYear: yY_ip },
    bokhui,
    dongjiDate: _getDongjiDate(year - 1),  // 전년 동지 (구간 시작점 표시용)
    jieqiInfo: monthG_ip._jieqi,
    ipchunDate: _getIpchunDate(year),
  };
};

// 간지에 한자 부착 (표시용)
const decorate = g => ({
  stem: g.stem, branch: g.branch,
  stemHanja: stemHanja[g.stem], branchHanja: branchHanja[g.branch],
});

// ════════════════════════════════════════════════════════════════════════
//  Vercel Serverless Function 엔트리포인트
// ════════════════════════════════════════════════════════════════════════
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용됩니다.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    let { calType, year, month, day, isLeap } = body || {};

    year = parseInt(year, 10);
    month = parseInt(month, 10);
    day = parseInt(day, 10);

    if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
      return res.status(400).json({ error: '생년월일을 올바르게 입력해주세요.' });
    }

    let solarY = year, solarM = month, solarD = day;
    let convertedFrom = null;

    // 음력 입력 시 양력 변환
    if (calType === 'lunar') {
      const conv = lunarToGreg(year, month, day, !!isLeap);
      if (!conv) {
        return res.status(400).json({ error: '존재하지 않는 음력 날짜입니다. (윤달 여부·일자를 확인해주세요)' });
      }
      convertedFrom = { year, month, day, isLeap: !!isLeap };
      solarY = conv.year; solarM = conv.month; solarD = conv.day;
    }

    const a = _analyzeBoth(solarY, solarM, solarD);

    // 응답: 알고리즘 내부값은 최소화, 표시에 필요한 결과만
    const pack = (side) => {
      const c = side.constitution;
      return {
        constitution: c.result,          // 사상 4체질 '소양인'
        sasang:       c.sasang,          // '소양'
        form:         c.form,            // 1 | 2
        formLabel:    c.formLabel,       // '소양인 2형' (내부/간략)
        displayLabel: c.displayLabel,    // '소양인 (Ⅱ형)' (화면 노출)
        kwon:         c.kwon,            // '토양'
        kwonLabel:    c.kwonLabel,       // '토양체질'
        foodKey:      c.foodKey,         // '소양2' (8체질 음식 키)
        effectiveYear: side.effectiveYear,
        ganji: {
          year:  decorate(side.ganji.year),
          month: decorate(side.ganji.month),
          day:   decorate(side.ganji.day),
        },
        note: c.note,
        trace: c.trace,                  // v25 s1/s2 판단근거
      };
    };

    return res.status(200).json({
      ok: true,
      input: {
        calType,
        solar: { year: solarY, month: solarM, day: solarD },
        convertedFrom,
      },
      primary: pack(a.primary),
      bokhui: a.bokhui ? {
        ...pack(a.bokhui),
        differs: a.bokhui.differs,
      } : null,
      dongjiDate: a.dongjiDate,
      jieqi: a.jieqiInfo ? {
        name: a.jieqiInfo.jieqi,
        date: a.jieqiInfo.jieqiDate,
        next: a.jieqiInfo.nextJieqi,
        nextDate: a.jieqiInfo.nextDate,
      } : null,
      ipchunDate: a.ipchunDate,
    });
  } catch (e) {
    return res.status(500).json({ error: '분석 중 오류가 발생했습니다.', detail: String(e && e.message || e) });
  }
}
