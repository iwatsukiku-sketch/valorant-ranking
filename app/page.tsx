import Link from "next/link";

export default function Home() {
  return (
    <div className="page">
      <h1 className="title">VALORANT 50体排除タイムアタック</h1>
      <p className="subtitle">射撃体験ブース　記録システム</p>

      <div className="home-links">
        <Link className="home-link" href="/input">
          <b>記録を入力する</b>
          <span>スタッフ用。スマホから結果を登録します</span>
        </Link>
        <Link className="home-link" href="/ranking">
          <b>ランキングを表示する</b>
          <span>会場モニター用。1920×1080 で全画面表示してください</span>
        </Link>
        <Link className="home-link" href="/admin">
          <b>記録を管理する</b>
          <span>訂正・削除・CSV書き出し</span>
        </Link>
      </div>
    </div>
  );
}
