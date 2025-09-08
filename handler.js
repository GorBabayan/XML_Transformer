import { parseStringPromise, Builder } from "xml2js";

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
                body: JSON.stringify({ message: "Body is empty" }),
            }
        }
        
        const inputXml = event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body;

        let obj;
        try {
            obj = await parseStringPromise(inputXml, { explicitArray: false, ignoreAttrs: false, xmlns: false });
        } catch(err) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Xml is invalid" }),
            }
        }

        const invoice = obj?.ExportedData?.Invoice;
        let goodsArray = invoice?.GoodsInfo?.Good;

        if (!goodsArray) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "No goods found" }),
            }
        }

        let goods = Array.isArray(goodsArray) ? goodsArray : [goodsArray];

        goods = goods.map(good => {
            if (good.Description.startsWith("Տոմատի մածուկ")) {
                const { Description, ...rest } = good;
                return { Description, ClassifierCode: "2002", ...rest };
            } else if (good.Description.startsWith("Կոնյակ")) {
                const { Description, ...rest } = good;
                return { Description, ClassifierCode: "2208", ...rest };
            } else {
                return { ...good, ClassifierCode: "0000" };
            }
        });

        invoice.GoodsInfo.Good = goods;

        const builder = new Builder({ xmldec: { version: "1.0", encoding: "UTF-8" }});
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
            body: JSON.stringify({ message: err.message }),
        }
    }
}