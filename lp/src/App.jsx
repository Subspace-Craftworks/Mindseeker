import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Github, Network, Sparkles, Archive, GitBranch, ShieldCheck, Check, X } from 'lucide-react';
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
      { text: 'AIチャット（1日10回）', included: true },
      { text: '累計100回まで利用可能', included: true },
      { text: 'Goal Tree / Subject / Task 管理', included: true },
      { text: 'MCP連携（ChatGPT等）', included: true },
      { text: '無制限チャット', included: false },
      { text: '優先サポート', included: false },
    ],
  },
  {
    name: 'Paid',
    price: 'Coming Soon',
    description: '本格的にゴール達成を目指す方へ',
    features: [
      { text: 'AIチャット無制限', included: true },
      { text: 'Goal Tree / Subject / Task 管理', included: true },
      { text: 'MCP連携（ChatGPT等）', included: true },
      { text: 'Artifacts 無制限', included: true },
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
      <div className="actions"><a className="primary" href="#beta">β版を試す <ArrowRight size={18}/></a><a className="secondary" href="#github"><Github size={18}/> GitHubを見る</a></div>
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
              <a className="primary plan-cta" href="#beta">無料で始める <ArrowRight size={16}/></a>
            ) : (
              <span className="plan-cta-disabled">準備中</span>
            )}
          </div>
        ))}
      </div>
    </section>
    <section className="open" id="github"><ShieldCheck/><h2>Built in public</h2><p>透明性を重視し、オープンなアーキテクチャで育てていきます。</p><a className="secondary" href="#">GitHub Repository</a></section>
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
