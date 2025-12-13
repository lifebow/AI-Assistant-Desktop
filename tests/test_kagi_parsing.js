
const testKagiParsing = () => {
    const rawText = `hi:{"v":"202512122357.stage.b0f672e","trace":"711b89a5c97530b60a4c77ed02e83011"}
new_message.json:{"id":"33c4b2cc-4a6d-4757-9acd-5fe81cf4afe1","thread_id":"c0e02f3f-8e60-4167-8936-7d216c829639","created_at":"2025-12-13T15:46:18Z","state":"done","prompt":"bitcoin price now","references_html":"<ol data-ref-list>...</ol>","references_md":"[^1]: [Bitcoin Price History and Historical Data | CoinMarketCap](https://coinmarketcap.com/currencies/bitcoin/historical-data/) (34%)\\n[^2]: [Bitcoin price today, BTC to USD live price, marketcap ...](https://coinmarketcap.com/currencies/bitcoin/) (24%)\\n[^3]: [Bitcoin Price Today | BTC to USD Live Price, Market Cap & Chart](https://www.binance.com/en-AE/price/bitcoin) (24%)\\n[^4]: [Cryptocurrency Prices, Charts And Market... | CoinMarketCap](https://coinmarketcap.com/) (12%)\\n[^5]: [Bitcoin Price Today | BTC to USD Live Price, Market Cap & ...](https://www.binance.com/en/price/bitcoin) (6%)\\n","reply":"...","md":"Content..."}`;

    let content = '';
    const sources = [];

    try {
        const lines = rawText.split('\n');
        for (const line of lines) {
            if (line.startsWith('new_message.json:')) {
                const jsonStr = line.substring('new_message.json:'.length);
                console.log('Found JSON string:', jsonStr.substring(0, 50) + '...');

                const data = JSON.parse(jsonStr);

                if (data.md) {
                    content = data.md;
                }

                if (data.references_md) {
                    console.log('Found references_md:', data.references_md);
                    // Format: [^1]: [Title](url) (percentage)
                    // Original regex
                    const regex = /\[\^(\d+)\]:\s*\[(.*?)\]\((.*?)\)/g;
                    let match;
                    while ((match = regex.exec(data.references_md)) !== null) {
                        console.log('Match found:', match[0]);
                        sources.push({
                            title: match[2],
                            url: match[3]
                        });
                    }
                }
                break;
            }
        }
    } catch (e) {
        console.error('Failed to parse:', e);
    }

    console.log('Sources:', JSON.stringify(sources, null, 2));
    console.log('Source count:', sources.length);
};

testKagiParsing();
