import { parseStringPromise, Builder } from "xml2js";
import { classifierMap } from "./classifierMap.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const transform = async (event) => {
    try {

        if (event.httpMethod === "OPTIONS") {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: "",
            };
        }

        if (!event.body) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: "Body is empty" }),
            }
        }
        
        const inputXml = event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body;

        let obj;
        try {
            obj = await parseStringPromise(inputXml, { 
                explicitArray: false, 
                ignoreAttrs: false, 
                trim: true,
                mergeAttrs: true,
            });
        } catch(err) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: "Xml is invalid" }),
            }
        }

        const invoice = obj?.ExportedData?.Invoice;
        let goodsArray = invoice?.GoodsInfo?.Good;

        if (!goodsArray) {
            return {
                statusCode: 400,
                headers: CORS_HEADERS,
                body: JSON.stringify({ message: "No goods found" }),
            }
        }

        let goods = Array.isArray(goodsArray) ? goodsArray : [goodsArray];

        goods = goods.map(good => { 
            const desc = good.Description?.trim(); 
            const code = classifierMap[desc]; 
            
            if (code) { 
                const { Description, ...rest} = good; 
                return { Description, ClassifierCode: code, ...rest }; 
            }
        });

        invoice.GoodsInfo.Good = goods;

        const builder = new Builder({ 
            xmldec: { version: "1.0", encoding: "UTF-8" },
            renderOpts: { pretty: true },
            headless: false,
        });
        const outputXml = builder.buildObject(obj);

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/xml" },
            body: outputXml,
        }
    } catch(err) {
        console.error("Transformation error: ", err);
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: err.message }),
        }
    }
}