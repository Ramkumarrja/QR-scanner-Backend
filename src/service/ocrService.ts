import multer from "multer";
import dotenv from "dotenv";
import fs from "fs-extra";
import { OpenAI } from "openai";

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Utility function to encode image to Base64
const encodeImageToBase64 = async (filePath: string): Promise<string> => {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer.toString("base64");
    } catch (error) {
      console.error("Error encoding image to Base64:", error);
      throw new Error("Failed to encode image");
    }
  };

// OCR Service function
export const ocrService = async (filePath: string) => {
    try {
      // // Convert the uploaded image to Base64
      // const base64Image = await encodeImageToBase64(filePath);
  
      // // Prepare the OCR prompt
      // const prompt = `
      //   What's in the image? This image contains some information, and I need it in JSON format. Please provide only the JSON as the result, without any additional text:
      //   - Name
      //   - FatherName
      //   - DateofBirth
      //   - CardNumber
      //   - Address
      // `;
  
      // // Call OpenAI API for OCR
      // const response = await openai.chat.completions.create({
      //   model: "gpt-4o-mini", // Use appropriate model version
      //   messages: [
      //     {
      //       role: "user",
      //       content:
      //         // JSON.stringify(
      //         [
      //           { type: "text", text: prompt },
      //           {
      //             type: "image_url",
      //             image_url: { url: `data:image/jpeg;base64,${base64Image}` },
      //           },
      //         ],
      //       // ),
      //     },
      //   ],
      //   max_tokens: 2000, // Adjust based on model and response size
      // });
  
      // const extractedText = response?.choices[0].message?.content;
  
      // if (!extractedText) {
      //   throw new Error("No text extracted from the image");
      // }
  
      // const jsonString = extractedText.replace(/^```json\n|```$/g, "");
  
      // let jsonObject: any
  
      // try {
      //    jsonObject = JSON.parse(jsonString);
      //   console.log(jsonObject);
      // } catch (error) {
      //   console.error("Invalid JSON:", error);
      // }
  
      // console.log("card Number type::", typeof Number(jsonObject.CardNumber))
      // console.log("card Number ::", jsonObject.CardNumber)
      // await fs.unlink(filePath);
  
      return { extracted: true, structuredData: {Name: "test",FatherName: "testFather", CardNumber:1234456, Address: "chennai" }};
    } catch (error: any) {
      console.error("Error in OCR service:", error);
      return { extracted: false, error: error.message };
    }
  };