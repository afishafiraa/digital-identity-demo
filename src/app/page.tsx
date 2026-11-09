import { DemoSession } from '@/components/demo-session';

const steps = [
  { number: '01', title: 'Receive', text: 'Get a fictional Training Certificate from Northstar Learning.' },
  { number: '02', title: 'Make it yours', text: 'Review the offer, accept it, and explore the credential in your wallet.' },
  { number: '03', title: 'Share with consent', text: 'Review the whole credential in Wallet (User), then approve or cancel.' },
  { number: '04', title: 'See the proof', text: 'Send your approved credential and see the actual verifier result.' },
];

export default function Home() {
  return <div className="shell">
    <header className="app-header">
      <a href="/" className="brand"><span className="brand-mark" aria-hidden="true">iw<span /></span><span>Identity Wallet<span className="brand-caption">A little more yours.</span></span></a>
      <span className="demo-label"><span aria-hidden="true" />Independent demo</span>
    </header>
    <main id="main" className="wallet-layout">
      <DemoSession />
      <aside className="wallet-guide" aria-label="About this demo">
        <div className="guide-intro">
          <p className="eyebrow">Less paperwork. More possibility.</p>
          <div className="wallet-art" aria-hidden="true"><div className="art-card art-card-back" /><div className="art-card art-card-front"><span className="art-chip" /><span className="art-line" /><span className="art-line short" /><span className="art-seal">✳</span></div><span className="art-orbit" /></div>
          <h2>Your achievements.<br />A place to keep them.</h2>
          <p>Receive a credential, see what it says, and choose when to share it.</p>
          <span className="fictional-pill">Fictional data. Real credential exchange.</span>
        </div>
        <section aria-labelledby="journey-title" className="journey">
          <div className="journey-header"><h2 id="journey-title">Take a look around</h2><span className="eyebrow">The walkthrough</span></div>
          <ol>{steps.map(step => <li key={step.number}><span className="step-number" aria-hidden="true">{step.number}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
          <p className="guide-note"><span aria-hidden="true">↳</span> One holder. One fictional scenario. Explore at your own pace.</p>
        </section>
      </aside>
    </main>
    <footer className="app-footer"><span>Built independently <span aria-hidden="true">↗</span> Powered by walt.id</span><span>Custodial demo · Not for personal documents</span></footer>
  </div>;
}
