import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Network, Sparkles, Archive, GitBranch, ShieldCheck, Check, X } from 'lucide-react';
import './style.css';

const features = [
  { icon: GitBranch, title: 'Goal Tree', text: '長期目標をツリーで整理し、次の一手まで落とし込みます。' },
  { icon: Network, title: 'AI Workspace', text: 'AIとの対話を通じて、背景・課題・行動の解像度を上げます。' },
  { icon: Archive, title: 'Artifacts', text: '会話で得た洞察や成果物を、後から見返せる知識として保存します。' },
];

const plans = [
  {
    name: 'Free',
    price: '¥0',
    description: 'まずは試してみたい方へ',
    features: [
      { text: 'AIチャット（1日10回 / 累計100回）', included: true },
      { text: 'アクティブゴール 3個まで', included: true },
      { text: 'Goal Tree / Subject / Task 管理', included: true },
      { text: 'MCP連携（ChatGPT等）', included: true },
      { text: '無制限チャット', included: false },
      { text: '無制限ゴール作成', included: false },
    ],
  },
  {
    name: 'Paid',
    price: 'Coming Soon',
    description: '本格的にゴール達成を目指す方へ',
    features: [
      { text: 'AIチャット無制限', included: true },
      { text: 'アクティブゴール無制限', included: true },
      { text: 'Goal Tree / Subject / Task 管理', included: true },
      { text: 'MCP連携（ChatGPT等）', included: true },
      { text: '優先サポート', included: true },
      { text: '新機能の先行アクセス', included: true },
    ],
  },
];

function App() {
  return <main>
    <nav className="nav"><div className="brand"><span className="logo">SC</span>Subspace Craftworks</div><a href="#beta">Join Beta</a></nav>
    <section className="hero">
      <p className="eyebrow"><Sparkles size={16}/> Open-source AI thinking workspace</p>
      <h1>Mindseeker</h1>
      <p className="lead">ゴールを中心に、AIと共に考え、行動し、成長するためのワークスペース。</p>
      <div className="actions"><a className="primary" href="https://mindseeker.subspace-craftworks.jp">β版を試す <ArrowRight size={18}/></a><a className="secondary" href="https://github.com/Subspace-Craftworks/Mindseeker"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg> GitHubを見る</a></div>
    </section>
    <section className="grid">{features.map(({icon:Icon,title,text}) => <article className="card" key={title}><Icon/><h3>{title}</h3><p>{text}</p></article>)}</section>
    <section className="philosophy"><div><p className="eyebrow">Philosophy</p><h2>More than a task manager</h2></div><p>Mindseekerは単なるToDo管理ではありません。目標と現実の差分を見つめ、AIとの継続的な対話を通して、思考そのものを更新していくための環境です。</p></section>
    <section className="shots"><h2>Workspace preview</h2><div className="shotgrid"><div>Goal Tree</div><div>AI Workspace</div><div>Knowledge Artifacts</div></div></section>
    <section className="pricing" id="pricing">
      <h2>Plans</h2>
      <p className="pricing-lead">シンプルな料金体系。まずは無料でお試しください。</p>
      <div className="plan-grid">
        {plans.map(plan => (
          <div className={`plan-card ${plan.name.toLowerCase()}`} key={plan.name}>
            <h3>{plan.name}</h3>
            <div className="plan-price">{plan.price}</div>
            <p className="plan-desc">{plan.description}</p>
            <ul className="plan-features">
              {plan.features.map(f => (
                <li key={f.text} className={f.included ? 'included' : 'excluded'}>
                  {f.included ? <Check size={16}/> : <X size={16}/>}
                  {f.text}
                </li>
              ))}
            </ul>
            {plan.name === 'Free' ? (
              <a className="primary plan-cta" href="https://mindseeker.subspace-craftworks.jp">無料で始める <ArrowRight size={16}/></a>
            ) : (
              <span className="plan-cta-disabled">準備中</span>
            )}
          </div>
        ))}
      </div>
    </section>
    <section className="open" id="github"><ShieldCheck/><h2>Built in public</h2><p>透明性を重視し、オープンなアーキテクチャで育てていきます。</p><a className="secondary" href="https://github.com/Subspace-Craftworks/Mindseeker">GitHub Repository</a></section>
    <section className="cta" id="beta"><h2>Join the Beta</h2><p>Subspace Craftworksによる実験的プロダクトとして、Mindseekerは進化中です。</p><a className="primary" href="mailto:hello@subspace-craftworks.jp">Contact us <ArrowRight size={18}/></a></section>
    <footer>
      <div className="footer-links">
        <a href="/privacy">プライバシーポリシー</a>
        <a href="mailto:hello@subspace-craftworks.jp">お問い合わせ</a>
      </div>
      <p>© 2026 Subspace Craftworks. All rights reserved.</p>
    </footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
