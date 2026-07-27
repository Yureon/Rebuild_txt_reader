# 사이트 언어팩 묶음 / Site Language Pack Bundle

이 폴더의 `*.json` 파일은 txt_reader_multi v560+의 관리자 공통 언어팩 형식입니다.

## 설치

프로젝트 루트에서 다음을 실행합니다.

```bash
sh tools/install_site_language_packs.sh
```

기본 복사 위치:

```text
./data/site-languages
```

컨테이너 내부 기준:

```text
/app/data/site-languages
```

## 포함 언어

- Arabic (`ar`)
- Czech (`cs`)
- German (`de`)
- Greek (`el`)
- Spanish (`es`)
- French (`fr`)
- Hindi (`hi`)
- Indonesian (`id`)
- Italian (`it`)
- Japanese (`ja`)
- Malay (`ms`)
- Dutch (`nl`)
- Polish (`pl`)
- Portuguese Brazil (`pt-br`)
- Romanian (`ro`)
- Russian (`ru`)
- Swedish (`sv`)
- Thai (`th`)
- Turkish (`tr`)
- Ukrainian (`uk`)
- Vietnamese (`vi`)
- Chinese Simplified (`zh-cn`)
- Chinese Traditional (`zh-tw`)

## 품질 기준

- 관리자/리더/검색/설정의 핵심 UI 레이블 위주로 번역했습니다.
- 모든 문구를 완전 번역한 것은 아닙니다.
- 누락된 문구는 앱의 기본 영어 fallback으로 표시됩니다.
- 운영 전 원어민 검수를 권장합니다.

## 편집

관리자 페이지의 `언어팩` 탭에서 각 언어팩을 편집할 수 있습니다.
