import React, { useState } from 'react';

/**
 * PCIS Dashboard Component
 * A regenerative community and wellness retreat business plan interface.
 */
const PCISDashboard: React.FC = () => {
    // State to manage portal visibility and content
    const [portalOpen, setPortalOpen] = useState(false);
    const [subPortalOpen, setSubPortalOpen] = useState(false);
    const [activeContent, setActiveContent] = useState<string | null>(null);

    const pcisData: Record<string, JSX.Element> = {
        'exec': (
            <>
                <h2 style={{ color: '#800020', fontSize: '30px', margin: '0 0 12px 0', borderBottom: '4px solid #800020', paddingBottom: '5px' }}>Executive Summary</h2>
                <div className="pcis-border-box" style={{ marginBottom: '10px' }}>
                    <p style={{ fontSize: '18px', lineHeight: '1.5', margin: '8px 0' }}>Permia Intentional Community & Integral Serenity (PCIS) is a regenerative eco-community and wellness retreat center...</p>
                </div>
            </>
        ),
        'vis_miss': (
            <>
                <h2 style={{ color: '#800020', fontSize: '30px', margin: '0 0 12px 0', borderBottom: '4px solid #800020', paddingBottom: '5px' }}>Vision & Mission Statement</h2>
                <div className="pcis-border-box">
                    <h3 style={{ color: '#800020', margin: '15px 0 8px 0', fontSize: '22px' }}>Vision Statement</h3>
                    <p style={{ fontSize: '18px', lineHeight: '1.5', margin: '8px 0' }}>To create a living model of regenerative community life...</p>
                </div>
            </>
        ),
        'biz': (
            <>
                <h2 style={{ color: '#800020', fontSize: '30px', margin: '0 0 12px 0', borderBottom: '4px solid #800020', paddingBottom: '5px' }}>Retreat Center Business Model</h2>
                <div className="pcis-border-box" style={{ marginBottom: '10px' }}>
                    <p><strong>Types of retreats may include:</strong></p>
                    <div className="content-grid">
                        <ul style={{ paddingLeft: '20px', margin: '10px 0', fontSize: '18px' }}><li>yoga retreats</li><li>meditation retreats</li></ul>
                        <ul style={{ paddingLeft: '20px', margin: '10px 0', fontSize: '18px' }}><li>energy healing</li><li>sound & mud bath</li></ul>
                    </div>
                </div>
                <div className="pcis-border-box">
                    <h4 style={{ color: '#800020', margin: '15px 0 8px 0', fontSize: '22px' }}>
                        Example Retreat Revenue (
                        <span 
                            className="price-link" 
                            onClick={() => { setSubPortalOpen(true); setActiveContent('capital'); }}
                            title="View capital requirements for price justification"
                            style={{ color: '#800020', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            price justification
                        </span>)
                    </h4>
                    <p>Average retreat size: 20 guests (capacity)</p>
                </div>
            </>
        ),
        'capital': (
            <>
                <h2 style={{ color: '#800020', fontSize: '30px', margin: '0 0 12px 0', borderBottom: '4px solid #800020', paddingBottom: '5px' }}>Startup Capital Requirements</h2>
                <table className="pcis-table">
                    <tbody>
                        <tr><td>Land: $150k–$300k</td><td>Infra: $300k–$500k</td></tr>
                        <tr><td>Eco-Domes: $250k–$750k</td><td>Energy: $300k–$500k</td></tr>
                        <tr><td>Water/Sanitation: $100k–$200k</td><td>Farming: $100k–$200k</td></tr>
                        <tr><td>Working Cap: $300k–$500k</td><td className="total-row"><strong>TOTAL: $1.8M – $3.7M</strong></td></tr>
                    </tbody>
                </table>
            </>
        )
        // Add other keys (proj, land, infra, etc.) following the same pattern
    };

    const handleOpen = (id: string) => {
        setActiveContent(id);
        setPortalOpen(true);
    };

    return (
        <>
            {/* Dashboard CSS */}
            <style>{`
                .pcis-main-dashboard { max-width: 900px; margin: 20px auto; font-family: 'Helvetica Neue', Arial, sans-serif; }
                .pcis-header { text-align: center; color: #800020; margin-bottom: 20px; }
                .pcis-row-trigger {
                    background: #ffffff; border: 1px solid #ddd;
                    border-left: 15px solid #800020 !important;
                    border-radius: 10px; margin: 8px 0; padding: 16px 30px; 
                    cursor: pointer; font-weight: 800; font-size: 22px;
                    color: #800020; width: 100%; display: flex;
                    justify-content: space-between; align-items: center;
                    transition: 0.3s;
                }
                .pcis-row-trigger:hover { background: rgba(128, 0, 32, 0.15); transform: translateX(5px); }
                
                #pcis-portal-bg, #pcis-sub-portal-bg {
                    position: fixed !important; top: 0; left: 0; width: 100vw; height: 100vh;
                    display: flex; align-items: center; justify-content: center;
                }
                #pcis-portal-bg { background: rgba(0, 0, 0, 0.9); z-index: 999999998; }
                #pcis-sub-portal-bg { background: rgba(0, 0, 0, 0.8); z-index: 999999999; }

                #pcis-portal-body, #pcis-sub-portal-body {
                    background: #fff; width: 96%; max-width: 1300px; padding: 23px 35px;
                    border-radius: 20px; position: relative; border-top: 15px solid #800020;
                    max-height: 94vh; overflow-y: auto; color: #333;
                }
                .pcis-portal-x { position: absolute; top: 15px; right: 25px; font-size: 40px; color: #800020; cursor: pointer; line-height: 1; }
                .pcis-border-box { background: #fafafa; padding: 15px; border-radius: 10px; border: 1px solid #eee; border-left: 10px solid #800020 !important; }
                .pcis-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .pcis-table td { padding: 12px; border: 1px solid #eee; font-size: 16px; }
                .total-row { background: #800020; color: #fff !important; font-weight: bold; }
                .content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
            `}</style>

            <div className="pcis-main-dashboard">
                <div className="pcis-header" title="Business Plan Main Header">
                    <h1 style={{ margin: 0, fontSize: '34px' }}>(PCIS) Permia Intentional Community &amp; Integral Serenity</h1>
                    <p style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#444' }}>Comprehensive Business Plan</p>
                </div>
                
                <button className="pcis-row-trigger" onClick={() => handleOpen('exec')} title="Executive Summary section">Executive Summary +</button>
                <button className="pcis-row-trigger" onClick={() => handleOpen('vis_miss')} title="Vision and Mission statement">Vision &amp; Mission +</button>
                <button className="pcis-row-trigger" onClick={() => handleOpen('biz')} title="Business model for the retreat center">Retreat Business Model +</button>
                {/* Add other buttons here as needed */}
            </div>

            {/* Main Portal Modal */}
            {portalOpen && (
                <div id="pcis-portal-bg" onClick={() => setPortalOpen(false)}>
                    <div id="pcis-portal-body" onClick={(e) => e.stopPropagation()} title="Main Details View">
                        <span className="pcis-portal-x" onClick={() => setPortalOpen(false)} title="Close section">×</span>
                        <div id="pcis-inject">
                            {activeContent && pcisData[activeContent]}
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Portal Modal */}
            {subPortalOpen && (
                <div id="pcis-sub-portal-bg" onClick={() => setSubPortalOpen(false)}>
                    <div id="pcis-sub-portal-body" onClick={(e) => e.stopPropagation()} title="Detailed breakdown view">
                        <span className="pcis-portal-x" onClick={() => setSubPortalOpen(false)} title="Close detailed view">×</span>
                        <div id="pcis-sub-inject">
                            {pcisData['capital']}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PCISDashboard;