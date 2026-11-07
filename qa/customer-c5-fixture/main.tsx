import React from 'react';
import { createRoot } from 'react-dom/client';
import { TrackingPage } from '../../src/modules/customer/customerTrackingPage';
import { HistoryPage } from '../../src/modules/customer/customerHistoryPage';
import '../../src/styles/index.css';
import '../../src/modules/customer/customer-ui.css';

function Fixture() {
  const [page, setPage] = React.useState<'tracking' | 'history'>('tracking');
  return page === 'tracking'
    ? <TrackingPage nav={<nav className="p-4"><button onClick={() => setPage('history')}>Orders</button></nav>}
        onNav={() => setPage('history')} orderId={new URLSearchParams(location.search).get('scenario') === 'empty' ? null : '11111111-1111-4111-8111-111111111111'}
        customerId="33333333-3333-4333-8333-333333333333" />
    : <HistoryPage nav={<nav className="p-4"><button onClick={() => setPage('tracking')}>Tracking</button></nav>}
        onNav={() => setPage('tracking')} onTrackOrder={() => setPage('tracking')} />;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
