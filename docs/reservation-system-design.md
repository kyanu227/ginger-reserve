# 酵素風呂予約システム設計書 v0.3

## 1. 目的

このWebサイトは、酵素風呂・よもぎ蒸し・関連オプションの予約受付、管理者による予約枠解放、予約管理、顧客管理、統計確認を行うための業務システムである。

顧客側は公開された時間枠の中から予約候補を選び、管理者側は営業状況に応じて予約可能枠を手動または半自動で解放する。重要な業務要件として、以下を扱う。

- 酵素風呂には同時利用人数の上限がある
- 初回客とリピーターで表示メニュー、価格、選択肢が変わる
- マッサージチェアは1台のみで、入浴前に順番に使用する
- 管理者が `open`、`request`、`closed` の枠を管理する
- 予約確定時にGoogleカレンダー、LINE、メールなどの外部通知を行う

このシステムは単なる予約フォームではなく、予約ドメインを持つ業務システムとして設計する。

## 2. 最重要原則

予約の最終判定はクライアントでは行わない。

顧客画面では空き枠、価格、リピーター向け表示を出すが、それらは予約を確定するための最終判定ではない。顧客画面の空き表示は、あくまで候補表示である。

予約作成時には、Cloud Functions または同等のサーバーAPIで以下を再判定し、条件を満たした場合のみFirestoreへ予約を保存する。

- 管理者が解放した予約枠に収まっているか
- 対象メニューまたはvariantを選択できる顧客か
- 選択されたメニューとオプションの `resourceRequirements` から `resourceUsages` を正しく生成できるか
- 酵素風呂などの共有リソース定員を超えていないか
- マッサージチェアなどの単独リソースが重複していないか
- リピーター判定が正しいか
- 価格計算が改ざんされていないか
- 同時送信による競合が起きていないか

Firestoreへ顧客が直接 `reservations` を作成する設計にはしない。重要コレクションへの書き込みは、サーバー側の検証を通す。

## 3. 時刻の考え方

顧客が選ぶ時刻は、原則として `bathStartAt`、つまり入浴開始時刻とする。

マッサージチェアを入浴前に利用する場合、来店目安時刻 `arrivalAt` は `bathStartAt` より前にずれる。

例:

```text
1人で20分チェアを使う場合
arrivalAt:    09:40
massageChair: 09:40-10:00
bath:         10:00-10:20

2人で20分ずつチェアを使う場合
arrivalAt:    09:20
massageChair: 09:20-10:00
bath:         10:00-10:20
```

表示上は「10:00入浴開始」でも、実際のリソース使用はマッサージチェアと酵素風呂で分かれる。予約判定では、表示時刻ではなく `resourceUsages` を正本として扱う。

マッサージチェアは特例ロジックではなく、`timing: 'beforeMain'` を持つオプションとして扱う。2人利用時に1台を順番に使う要件は、`sequentialPerGuest: true` と `durationSource: 'selectedDurationPerGuest'` から `resourceUsages` を生成することで表現する。

## 4. リソース設計

予約可否は `menuId` 単位ではなく、設備リソース単位で判定する。メニューやオプション自体に人数制限・時間制限を直接持たせるだけでは不十分であり、正しくは「そのメニューまたはオプションが、どの設備リソースを、何分間、何単位消費するか」を `resourceRequirements` として持たせる。

代表的なリソース:

| resourceId | 説明 | capacity |
|---|---|---:|
| `enzymeBath` | 酵素風呂設備 | 2 |
| `yomogiRoom` | よもぎ蒸し設備 | 設定値 |
| `massageChair` | マッサージチェア | 1 |

酵素風呂カテゴリ内の複数メニューは、すべて `enzymeBath` を消費する。したがって、初回酵素風呂、リピーター酵素風呂、セット有無などが別メニューや別variantになっても、同じ `resourceId=enzymeBath` の予約人数を合算して定員判定する。

マッサージチェアは `resourceId=massageChair` として扱い、同時使用数は1とする。2名予約で2人ともチェアを使う場合は、同じチェアを連続して使うため、`sequentialPerGuest: true` の要求から利用者ごとの連続したリソース使用時間を生成する。

この抽象化により、水素吸入、岩盤浴、別のチェア、スタッフ施術などを追加する場合も、新しい `resource` と、そのリソースを消費する `menu` または `option` を追加すればよい。予約判定エンジンは `resourceUsages` だけを見ればよく、個別オプションごとの特例分岐を増やさない。

## 5. resourceRequirements と resourceUsages

`resourceRequirements` は、メニューまたはオプションがリソースをどう消費するかの定義である。`resourceUsages` は、特定の予約内容、人数、選択時間、入浴開始時刻から生成された実際のリソース使用時間である。

メニュー例:

```js
{
  id: 'enzymeBath',
  name: '酵素風呂',
  category: 'enzyme',
  active: true,
  durationMinutes: 20,
  resourceRequirements: [
    {
      resourceId: 'enzymeBath',
      phase: 'main',
      durationMinutes: 20,
      units: 'guests'
    }
  ]
}
```

オプション例:

```js
{
  id: 'massageChair',
  name: 'マッサージチェア',
  active: true,
  price: 0,
  eligibleMenuCategories: ['enzyme'],
  selectableDurations: [10, 20, 30],
  timing: 'beforeMain',
  sequentialPerGuest: true,
  resourceRequirements: [
    {
      resourceId: 'massageChair',
      phase: 'beforeMain',
      capacityUnits: 1,
      durationSource: 'selectedDurationPerGuest'
    }
  ]
}
```

生成される `resourceUsages` 例:

```js
[
  {
    resourceId: 'massageChair',
    startAt: '2026-03-20T09:20:00+09:00',
    endAt: '2026-03-20T09:40:00+09:00',
    units: 1,
    guestIndex: 1
  },
  {
    resourceId: 'massageChair',
    startAt: '2026-03-20T09:40:00+09:00',
    endAt: '2026-03-20T10:00:00+09:00',
    units: 1,
    guestIndex: 2
  },
  {
    resourceId: 'enzymeBath',
    startAt: '2026-03-20T10:00:00+09:00',
    endAt: '2026-03-20T10:20:00+09:00',
    units: 2
  }
]
```

空き判定は `menuId` や `optionId` ではなく、この `resourceUsages` の `resourceId`、時間帯、`units` を使って行う。

## 6. メニューとvariant

メニューは基本サービスを表し、価格やリピーター条件の違いは `variants` として持つ。

例:

```js
{
  id: 'enzymeBath',
  name: '酵素風呂',
  category: 'enzyme',
  durationMinutes: 20,
  active: true,
  resourceRequirements: [
    {
      resourceId: 'enzymeBath',
      phase: 'main',
      durationMinutes: 20,
      units: 'guests'
    }
  ],
  variants: [
    {
      id: 'firstTime',
      name: '初回',
      price: 3900,
      minVisits: -1,
      active: true
    },
    {
      id: 'repeatWithWear',
      name: 'リピーター・ウェアあり',
      price: 3900,
      minVisits: 1,
      active: true
    },
    {
      id: 'repeatWithoutWear',
      name: 'リピーター・ウェアなし',
      price: 3500,
      minVisits: 1,
      active: true
    }
  ]
}
```

顧客画面ではリピーター判定に応じて選択可能なvariantだけを表示する。ただし、予約作成時にはサーバー側で再度variantの選択可否と価格を判定する。

## 7. Firestoreデータモデル案

### `resources`

設備リソースを管理する。capacityは設定値で上書きできるが、初期値はリソース定義に持つ。

```js
{
  id: 'enzymeBath',
  name: '酵素風呂',
  capacity: 2,
  active: true,
  order: 0
}
```

### `menus`

表示可能な基本メニューを管理する。

```js
{
  id: 'enzymeBath',
  name: '酵素風呂',
  description: '',
  icon: '',
  category: 'enzyme',
  durationMinutes: 20,
  resourceRequirements: [
    {
      resourceId: 'enzymeBath',
      phase: 'main',
      durationMinutes: 20,
      units: 'guests'
    }
  ],
  variants: [],
  active: true,
  order: 0
}
```

### `options`

オプションを管理する。リソースを消費するオプションは `resourceRequirements` を持つ。

```js
{
  id: 'massageChair',
  name: 'マッサージチェア',
  price: 0,
  eligibleMenuCategories: ['enzyme'],
  timing: 'beforeMain',
  selectableDurations: [10, 20, 30],
  sequentialPerGuest: true,
  resourceRequirements: [
    {
      resourceId: 'massageChair',
      phase: 'beforeMain',
      capacityUnits: 1,
      durationSource: 'selectedDurationPerGuest'
    }
  ],
  active: true,
  order: 0
}
```

### `availabilityWindows`

管理者が解放した予約可能枠である。単なる時刻リストではなく、時間範囲、状態、対象リソースまたはカテゴリ、定員上書きを持てるようにする。

```js
{
  id: '2026-03-20_09:00_12:00',
  date: '2026-03-20',
  startAt: '2026-03-20T09:00:00+09:00',
  endAt: '2026-03-20T12:00:00+09:00',
  status: 'open', // open | request | closed
  resourceIds: ['enzymeBath', 'massageChair'],
  capacityOverrides: {
    enzymeBath: 2,
    massageChair: 1
  },
  memo: '',
  createdAt: '',
  updatedAt: ''
}
```

顧客が予約できるのは、必要な全リソース使用時間がこの解放枠に収まる場合のみとする。`beforeMain` のリソース使用がある場合は、その開始時刻からメインメニュー終了時刻までが解放枠に収まるかを判定する。

### `reservations`

予約の正本である。顧客入力値だけでなく、予約時点のメニュー、価格、所要時間、リピーター判定、オプション内容、リソース使用時間をスナップショットとして保存する。

```js
{
  id: 'RES-xxxx',
  status: 'confirmed', // pending | confirmed | cancelled | completed | rejected | noShow
  customerId: 'cust_xxx',
  customerSnapshot: {
    lastName: '',
    firstName: '',
    phone: '',
    email: '',
    visitCountAtBooking: 0,
    isRepeaterAtBooking: false
  },
  menuSnapshot: {
    menuId: 'enzymeBath',
    menuName: '酵素風呂',
    variantId: 'firstTime',
    variantName: '初回',
    unitPrice: 3900,
    durationMinutes: 20,
    resourceRequirements: [
      {
        resourceId: 'enzymeBath',
        phase: 'main',
        durationMinutes: 20,
        units: 'guests'
      }
    ]
  },
  optionSnapshots: [
    {
      optionId: 'massageChair',
      optionName: 'マッサージチェア',
      price: 0,
      selectedDurationPerGuest: 20,
      timing: 'beforeMain',
      sequentialPerGuest: true,
      resourceRequirements: [
        {
          resourceId: 'massageChair',
          phase: 'beforeMain',
          capacityUnits: 1,
          durationSource: 'selectedDurationPerGuest'
        }
      ]
    }
  ],
  guests: 2,
  bathStartAt: '2026-03-20T10:00:00+09:00',
  bathEndAt: '2026-03-20T10:20:00+09:00',
  arrivalAt: '2026-03-20T09:20:00+09:00',
  resourceUsages: [
    {
      resourceId: 'massageChair',
      startAt: '2026-03-20T09:20:00+09:00',
      endAt: '2026-03-20T09:40:00+09:00',
      units: 1,
      guestIndex: 1
    },
    {
      resourceId: 'massageChair',
      startAt: '2026-03-20T09:40:00+09:00',
      endAt: '2026-03-20T10:00:00+09:00',
      units: 1,
      guestIndex: 2
    },
    {
      resourceId: 'enzymeBath',
      startAt: '2026-03-20T10:00:00+09:00',
      endAt: '2026-03-20T10:20:00+09:00',
      units: 2
    }
  ],
  totalPrice: 7800,
  priceBreakdown: [
    { label: '酵素風呂 初回 x 2名', amount: 7800 },
    { label: 'マッサージチェア', amount: 0 }
  ],
  notes: '',
  calendarEventIds: [],
  createdAt: '',
  updatedAt: ''
}
```

過去予約の金額や内容が後から変わらないように、予約時点のスナップショットを保存する。特に `resourceRequirements` と生成済みの `resourceUsages` を保存しておくと、後からメニューやオプション定義が変わっても、過去予約の設備使用実績を再現できる。

### `customers`

顧客情報は公開しない。

```js
{
  id: 'cust_xxx',
  lastName: '',
  firstName: '',
  lastNameKana: '',
  firstNameKana: '',
  phone: '',
  phoneNorm: '',
  email: '',
  visitCount: 0,
  lastVisitDate: '',
  memo: '',
  createdAt: '',
  updatedAt: ''
}
```

顧客画面でリピーターかどうかを確認したい場合は、`checkRepeaterEligibility` のようなサーバーAPIを用意する。返す値は `isRepeater`、`visitCountBand`、`eligibleVariantIds` 程度に抑え、顧客一覧や個人情報を公開しない。

### `settings`

公開設定と非公開設定を分ける。

```text
settings/public
settings/private
```

公開してよいもの:

- 店舗名
- 公開表示用の営業設定
- 顧客画面に必要な制限値

公開してはいけないもの:

- GAS URL
- GAS secret
- LINE token
- カレンダー連携用の秘密値
- 管理者向け内部設定

## 8. 予約作成API

予約作成は `createReservation` サーバーAPIで行う。

推奨する流れ:

1. 顧客画面が希望内容を送信する
2. サーバー側でFirestore transactionを開始する
3. 現在の設定、対象リソース、対象メニュー、対象variant、対象オプション、顧客情報、対象日の解放枠、重複しうる既存予約を読む
4. リピーター状態を再判定する
5. variantの選択可否を再判定する
6. 価格を再計算する
7. メニューと選択オプションの `resourceRequirements` から `bathStartAt`、`bathEndAt`、`arrivalAt`、`resourceUsages` を生成する
8. 解放枠に収まるか判定する
9. 各リソースのcapacityを超えないか判定する
10. 問題がなければ予約を作成する
11. 必要に応じて顧客統計を更新する
12. 通知ジョブを発行する

満枠、枠外、不正なvariant、価格不一致、リピーター対象外、同時送信競合の場合は予約を保存せず、安定したエラーコードを返す。

例:

```js
{
  ok: false,
  code: 'RESOURCE_FULL',
  message: 'この時間帯は満席です'
}
```

## 9. 構造化方針

本システムでは、予約条件が増えても壊れにくいように、画面、UI部品、業務処理、予約ドメイン、外部I/Oを分離する。

依存方向は以下を基本とする。

```text
pages
  ↓
features / components / hooks
  ↓
application / useCases
  ↓
domain / reservation
  ↓
infrastructure / repositories / api clients
```

`pages` はルーティングと画面状態に限定する。たとえば `ReservationPage` は、現在のステップ、フォーム入力値、送信中かどうか、エラー表示などを扱う。価格計算、空き判定、リピーターvariant判定、`resourceUsages` 生成などの業務ルールは pages に置かない。

`features`、`components`、`hooks` はUI部品とフォーム操作を担当する。コース選択、オプション選択、日時選択、確認画面、管理画面のカレンダー操作などはここに置く。ただし、ここでも予約可否の正本判定やFirestore/GASへの業務書き込みは行わない。

`application/useCases` は、画面やAPIから呼ばれる業務処理を担当する。たとえば以下のような単位で分ける。

- `createReservationUseCase`
- `getAvailabilityPreviewUseCase`
- `calculateReservationPreviewUseCase`
- `updateAvailabilityWindowsUseCase`
- `approveReservationUseCase`
- `cancelReservationUseCase`

useCase は domain の純粋関数と repository/API を組み合わせる。画面は useCase を呼び、useCase が必要なデータ取得、domain計算、保存API呼び出しを整理する。

`domain/reservation` は React、Firebase、GAS、Cloud Functions SDK に依存しない純粋関数層にする。ここが予約ルールの正本である。

主な責務:

- `menu` / `option` の `resourceRequirements` から `resourceUsages` を生成する
- 酵素風呂とマッサージチェアを別resourceとして扱う
- `resourceId`、時間帯、`units` による空き判定を行う
- 価格計算を行う
- リピーターvariantの選択可否を判定する
- 予約リクエストの妥当性を検証する

想定する純粋関数:

```text
buildResourceUsages()
calculatePrice()
checkAvailability()
resolveEligibleMenuVariants()
validateReservationRequest()
```

フロントの空き表示とサーバー側の最終判定は、同じ予約ルールを参照できる構造にする。フロント側では「この条件なら空いていそう」という候補表示を行い、サーバー側ではtransaction内で「本当に保存してよいか」を判定する。両者が別々のロジックになると、枠外予約、過予約、価格不一致、リピーター判定のずれが起きる。

`infrastructure/repositories/api clients` は外部I/Oのみを担当する。Firestore、GAS、Firebase Auth、Cloud Functions呼び出しなどはここに閉じ込める。画面やdomain層から直接Firestore/GASに触れない。

将来的には、現在の一体化したAPI層を以下のように分ける。

```text
src/infrastructure/repositories/reservationRepository.js
src/infrastructure/repositories/menuRepository.js
src/infrastructure/repositories/customerRepository.js
src/infrastructure/repositories/settingsRepository.js
src/infrastructure/api/gasClient.js
src/infrastructure/api/functionsClient.js
src/infrastructure/auth/firebaseAuthClient.js
```

予約作成の最終判定は Cloud Functions または同等のサーバーAPIで行う。フロントの空き表示は候補表示であり、保存可否の正本ではない。

## 10. フロントエンド責務

フロントエンドは業務判定を直接持ちすぎない。

顧客画面の責務:

- 入力フォームの表示
- 候補枠の表示
- 概算価格の表示
- サーバーAPIへの予約作成リクエスト
- サーバーから返ったエラーの表示

管理画面の責務:

- 予約一覧、カレンダー、枠管理、メニュー管理、統計の表示
- 管理者操作のAPI呼び出し
- 状態変更や枠解放の入力支援

空き判定、価格計算、リソース使用時間の生成は、以下のような純粋関数層へ切り出す。

```text
src/domain/reservation/time.js
src/domain/reservation/resources.js
src/domain/reservation/requirements.js
src/domain/reservation/pricing.js
src/domain/reservation/availability.js
src/domain/reservation/eligibility.js
```

顧客画面も管理画面も同じ純粋関数を使って候補表示を行う。ただし、保存の最終判定はサーバーAPI側に置く。フロント側にマッサージチェア専用の特例分岐を増やさず、`resourceRequirements` から `resourceUsages` を生成する共通処理へ寄せる。

## 11. Firestore rules方針

公開readと非公開read/writeを明確に分ける。

公開してよいもの:

- 顧客画面に必要な公開メニュー
- 公開可能な予約可能枠
- 顧客画面用の公開設定

公開してはいけないもの:

- `customers`
- `reservations`
- 管理者向け設定
- GAS URL
- secret
- LINE token
- スタッフメモ

顧客による `reservations` 直接createは原則禁止する。予約作成はCloud Functionsまたは同等のサーバーAPI経由に限定する。

管理者権限は、クライアントに置いたメール一覧だけに依存しない。custom claims、または `admins/{uid}` のようにサーバー側で検証可能な仕組みに寄せる。

## 12. 外部通知

予約保存後のGoogleカレンダー、LINE、メール通知は、予約判定とは分離する。

予約作成transaction内で外部APIを直接呼ぶと、外部API失敗時に予約保存との整合性が崩れやすい。予約保存後に通知ジョブを作り、Cloud Functions、GAS、または管理者向け再送処理で処理する。

通知に失敗しても予約そのものは失わない。予約には通知状態を保存する。

```js
{
  notificationStatus: {
    calendar: 'pending',
    line: 'sent',
    email: 'failed'
  }
}
```

## 13. 統計設計

最初は `reservations` から集計してよい。

集計対象は原則として `confirmed` と `completed` の予約に限定する。`cancelled`、`rejected`、`noShow` は別集計にする。

見るべき軸:

- 月別売上
- メニュー別件数
- variant別件数
- リピーター率
- 初回客数
- キャンセル率
- 曜日別予約数
- 時間帯別予約数
- オプション利用率
- リソース稼働率

予約数が増えて表示が重くなったら、Cloud Functionsで `monthlyStats` のような集計ドキュメントを更新する設計へ移行する。

## 14. 段階的な実装順序

1. 既存WIPを現状実装として取り込む
2. この設計書を正本として更新する
3. `domain/reservation` の純粋関数層を追加する
4. `resources`、`resourceRequirements`、`resourceUsages` の生成と判定をdomainへ移す
5. フロント表示用の空き判定と価格計算をdomain/useCaseへ移す
6. `createReservation` サーバーAPIを実装する
7. 予約作成をFirestore transactionで正本判定する
8. Firestore rulesを締め、顧客の直接予約作成と非公開データreadを禁止する
9. 管理画面の予約作成、承認、キャンセル処理も同じサーバーAPIへ寄せる
10. 外部通知を予約保存後のジョブとして分離する
11. 巨大化した画面をpages、features、hooks、application、domain、infrastructure単位に分割する
12. 統計集計を必要に応じて集計ドキュメント化する

## 15. PR方針

既存WIPと設計上書きは、できるだけcommitまたはPRを分ける。

最初に既存WIPを「現状実装の取り込み」としてまとめる。その後に、設計書を `menu` / `option` の `resourceRequirements` 方式へ寄せる。さらにその後、実装を設計正本へ上書きしていく。

設計書更新PRは docs-only にする。

変更対象:

- `docs/reservation-system-design.md`

変更しないもの:

- `src/**`
- `package.json`
- `firestore.rules`
- Firebase deploy設定
- 実データ

この設計書更新では、既存実装との完全な互換性よりも、今後安全に作り直すための設計の正確さを優先する。

次以降のPRは、以下の順で分ける。

1. domain純粋関数の追加
2. application/useCases と infrastructure/repositories の追加
3. 予約作成APIの正本化
4. Firestore rulesの締め
5. 巨大画面の分割
6. 通知処理の分離
7. 統計処理の整理
