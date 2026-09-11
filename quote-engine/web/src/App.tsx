import { Shell } from './components/Shell';
import { useApp } from './state/app';
import { Classify } from './screens/Classify';
import { QuoteDocumentScreen } from './screens/QuoteDocumentScreen';
import { QuoteBuilder } from './screens/QuoteBuilder';
import { QuoteDetail } from './screens/QuoteDetail';
import { Orders } from './screens/Orders';
import { Quotes } from './screens/Quotes';
import { RuleEditor } from './screens/RuleEditor';
import { Analytics } from './screens/Analytics';
import { Rules } from './screens/Rules';
import { Panel, Skeleton } from './components/ui';

export default function App() {
  const { route, session, loading, go } = useApp();

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Panel title="Signing in"><Skeleton rows={4} /></Panel>
      </div>
    );
  }

  // No role means no access. The app denies rather than defaulting to something.
  if (!session) {
    return (
      <div className="mx-auto max-w-lg p-10">
        <Panel title="No access">
          <p className="px-4 py-4 text-sm text-steel-700">
            Your account did not resolve to a CPQ role. Access is granted by Microsoft 365 group
            membership — ask IT to add you to the appropriate CPQ group.
          </p>
        </Panel>
      </div>
    );
  }

  /* Reading is not editing.
     Rules and classification used to be admin-only outright, so a rep who asked
     "why was the 6440 not recommended" was told the rule existed and shown a door
     they could not open — and the tool's whole argument is that a quote can be
     defended by the person sending it. Everyone can read both screens; only an
     admin can change them, which the screens enforce themselves.
     Creating a rule stays admin-only: there is nothing to read at that address. */
  const adminOnly = route.name === 'newRule';

  return (
    <Shell>
      {adminOnly && session.role !== 'admin' ? (
        <Panel title="Not available to your role">
          <p className="px-4 py-4 text-sm text-steel-700">
            Writing a new rule is an administrator's job. You can read any existing rule,
            and see which ones fired on a quote from the quote itself.
          </p>
        </Panel>
      ) : (
        <>
          {route.name === 'quotes' && <Quotes />}
          {route.name === 'quote' && <QuoteDetail quoteNo={route.quoteNo} />}
          {route.name === 'newQuote' && <QuoteBuilder startAt={route.start} />}
          {route.name === 'quoteDocument' && <QuoteDocumentScreen quoteNo={route.quoteNo} />}
          {route.name === 'editQuote'
            && <QuoteBuilder quoteNo={route.quoteNo} pickRole={route.pickRole} />}
          {route.name === 'orders' && <Orders customerNo={route.customerNo ?? null} />}
          {route.name === 'analytics' && <Analytics />}
          {route.name === 'rules' && <Rules />}
          {route.name === 'rule' && <RuleEditor ruleCode={route.ruleCode} />}
          {route.name === 'newRule' && <RuleEditor ruleCode={null} />}
          {route.name === 'mappings' && <Classify />}
          {route.name === 'notFound' && (
            <Panel title="No screen at that address">
              <div className="space-y-3 p-4">
                <p className="text-sm text-steel-800">
                  <span className="num">{route.attempted}</span> does not match anything in
                  this tool. It is most likely a stale bookmark.
                </p>
                <button type="button" className="btn-primary text-sm"
                        onClick={() => go({ name: 'quotes' })}>
                  Go to quotes
                </button>
              </div>
            </Panel>
          )}
        </>
      )}
    </Shell>
  );
}
