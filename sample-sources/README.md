# 원본 샘플 보관함 (밴드 악기)

게임에 바로 쓰는 파일이 아니라, 나중에 곡을 만들 때 필요한 음만 골라 `samples/*.js`로 변환하기 위한 **원본 라이브러리**입니다.
용량이 크므로(수 GB) 게임을 배포할 때는 이 폴더를 **빼고** 올리세요.

받은 날: 2026-10-21. 모두 라이선스를 원본 페이지와 LICENSE 파일에서 직접 확인했습니다.
전체 약 3.9GB. 형식: Karoryfer 기타·베이스는 WAV(44.1kHz), FreePats 기타·Virtuosity·MuldjordKit은 FLAC(24bit, 44.1/48kHz).
각 폴더의 `.sfz` 파일에 음 번호·세기·라운드로빈 매핑이 들어 있으니, 샘플을 고를 때 참고하세요.

| 폴더 | 악기 | 라이선스 | 출처 표기 |
|---|---|---|---|
| `guitar_karoryfer-black-and-green` | 할로우바디 일렉 기타 2대 (Gretsch Anniversary, Hofner Club). 일반·스타카토·해머온·브리지 뒤·피드백, 3단 세기 × 라운드로빈 4 | CC0 1.0 | 의무 없음 |
| `guitar_karoryfer-emilyguitar` | Epiphone 일렉 기타 (다이렉트 녹음). 4단 세기 × 라운드로빈 3, **파워·메이저·마이너 코드 샘플** | CC0 1.0 | 의무 없음 |
| `guitar_freepats-fsbs-clean` | Fender 일렉 기타, 앰프·이펙트 거친 **클린 톤**. C2~C#6, 2단 세기 | CC0 1.0 | 의무 없음 |
| `guitar_freepats-fsbs-dist1` | 같은 기타, **디스토션** 톤 #1 (더 두꺼움) | CC0 1.0 | 의무 없음 |
| `guitar_freepats-fsbs-dist2` | 같은 기타, 디스토션 톤 #2 | CC0 1.0 | 의무 없음 |
| `bass_karoryfer-black-and-blue` | 5현 일렉 베이스 2대. darkblack: 4단 세기 × 라운드로빈 4, 고스트노트·스타카토·브리지 뒤 / babyblue: 2단 세기 × 라운드로빈 8 | CC0 1.0 | 의무 없음 |
| `drums_virtuosity` | 재즈·라이브 클럽 느낌의 드럼 킷 (Versilian Studios + Karoryfer). 마이크 6개, 하이햇 닫힘/열림/하프/페달, 스네어 12종, 탐, 라이드, 크래시 + 보조 타악기 | CC0 1.0 | 의무 없음 |
| `drums_muldjordkit` | 록·메탈 드럼 킷 (Lars Muldjord / DrumGizmo, FreePats 스테레오판). 킥 2, 스네어 2, 하이햇 열림/닫힘, 탐 4, 크래시 2, 라이드 2, 차이나 | **CC BY 4.0** | **필수** |

## 출처 표기 규칙

- **MuldjordKit을 쓰는 곡을 넣으면** 타이틀 화면 오른쪽 아래(`js/game.js`의 샘플 출처 줄)와 `CREDITS.md`에 반드시 넣기.
  원작자가 정한 문구: **"Drum samples provided by DrumGizmo.org"**
  예: `Drums: MuldjordKit by Lars Muldjord, DrumGizmo.org (CC BY 4.0)`
- CC0 라이브러리는 표기 의무가 없지만, 기존처럼 `CREDITS.md`에는 적어 두는 것을 권장.

## 받은 곳

- Black And Green Guitars v1.000 — https://github.com/sfzinstruments/karoryfer.black-and-green-guitars (Karoryfer Samples)
- Emilyguitar v1.001 — https://github.com/sfzinstruments/karoryfer.emilyguitar (Karoryfer Samples, D. Smolken)
- FSBS Electric Guitar clean 2026-08-07 / dist1·dist2 2022-09-11 — https://freepats.zenvoid.org/ElectricGuitar/ (FreePats)
- Black And Blue Basses v1.002 — https://github.com/sfzinstruments/karoryfer.black-and-blue-basses (Karoryfer Samples)
- Virtuosity Drums v0.925 — https://github.com/sfzinstruments/virtuosity_drums (Versilian Studios + Karoryfer Samples)
- MuldjordKit (FreePats 2020-10-18) — https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html (원작 Lars Muldjord, https://drumgizmo.org)

Karoryfer 공식 무료 페이지: "All our free sample libraries are under a Creative Commons Zero license."
각 폴더 안의 LICENSE / README 파일이 원본 라이선스 문서입니다.
