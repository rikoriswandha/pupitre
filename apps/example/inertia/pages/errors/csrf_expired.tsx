import MarketingLayout from '~/layouts/marketing'

export default function CsrfExpired() {
  return (
    <div className="home">
      <article className="prose-card">
        <h1>Request expired</h1>
        <p>The request was not processed. Reload the page before trying again.</p>
        <a href="/">Return home</a>
      </article>
    </div>
  )
}

CsrfExpired.layout = [MarketingLayout]
