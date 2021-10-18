const fs = require('fs');
const {parse} = require('json2csv');
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const scrape = async () => {
    let response = []
    let pageURL = 'https://www.glassdoor.com/Interview/data-scientist-interview-questions-SRCH_KO0,14_SDRD.htm'

    for (let p = 0; p < 10; p++) {
        console.log(`Scrapping page ${p + 1} of 10.. ${pageURL}`)

        // A rotating proxy can be used in case of a heavy duty srapping session.
        // args: ['--proxy-server=socks5://127.0.0.1:9050'],
        const options = {
            headless: false,
        }
        const browser = await puppeteer.launch(options);
        const page = await browser.newPage();

        await page.goto(pageURL);
        await page.waitFor(10*1000);
        const result = await page.evaluate(async () => {
            const nth_ocurrence = (str, needle, nth) => {
                for (i = 0; i < str.length; i++) {
                    if (str.charAt(i) == needle) {
                        if (!--nth) {
                            return i;
                        }
                    }
                }
                return false;
            }

            const pageResponse = [];
            let questions = document.querySelectorAll('[id^=InterviewQuestionResult]');

            for (let i = 0; i < questions.length; i++) {
                const questionNode = questions[i];
                const avatarLink = questionNode.querySelector('.sqLogoLink').href;

                //between last '/' and 3rd '-' counting backwards
                //example, extract Innovid from 'https://www.glassdoor.com.ar/Entrevista/Innovid-Preguntas-entrevistas-E434734.htm'
                const unformattedCompanyName = decodeURI(avatarLink.substring(avatarLink.lastIndexOf('/') + 1, avatarLink.length - nth_ocurrence(avatarLink.split("").reverse().join(""), '-', 3) - 1));
                const date = questionNode.querySelector('.cell.alignRt.noWrap.minor').innerText

                //between company name and 3d '-' counting backwards. Then replace '-' by spaces
                //example extract 'Data Engineer' from  <a href="/Entrevista/Tiendanube-Data-Engineer-Preguntas-entrevistas-EI_IE1732785.0,10_KO11,24.htm">A un Data Engineer en Tiendanube se le preguntó...</a>
                const positionLink = questionNode.querySelector('.authorInfo').innerHTML;
                const jobTitle = positionLink.substring(
                    positionLink.indexOf(unformattedCompanyName) + unformattedCompanyName.length + 1,
                    positionLink.length - nth_ocurrence(
                        positionLink.split("").reverse().join(""), '-', 3) - 1)
                    .replaceAll('-', ' ');

                //replace '-' by spaces
                const companyName = unformattedCompanyName.replaceAll('-', ' ');

                const question = questionNode.querySelector('.questionText.h3').innerText

                let answer = ''
                if (questionNode.querySelector('.userResponseLink.margTop.block.hiddenLink.mmLink') !== null) {
                    //TODO check if already clicked.
                    questionNode.querySelector('.userResponseLink.margTop.block.hiddenLink.mmLink').click();
                    await new Promise(function (resolve) {
                        setTimeout(resolve, 200)
                    });
                    const answerEl = questionNode.querySelector('.cell.noMargVert.padTop.tightBot')
                    answer = answerEl ? answerEl.innerText : '';
                }

                pageResponse.push({
                    companyName,
                    jobTitle,
                    question,
                    answer,
                    date
                })

            }
            const nextPage = document.querySelector('.next').firstElementChild
            pageURL = nextPage.href ? nextPage.href : null;
            return {pageResponse, pageURL}
        });

        response = response.concat(result.pageResponse)
        pageURL = result.pageURL;
        await browser.close();
        if (!pageURL){break;}
    }
    console.log(`Finish Scrapping`)
    return response;
};

const main = async () => {
    console.log('Starting')
    const scrapResult = await scrape();
    await fs.writeFileSync('./scrapResult.json', JSON.stringify(scrapResult))
    await fs.writeFileSync('./scrapResult.csv', parse(scrapResult))
    console.log(scrapResult.length)
}

main();
