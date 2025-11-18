from fastapi import FastAPI
from langchain_aws import ChatBedrock
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel

app = FastAPI()

class PromptCreate(BaseModel):
   question: str

# Initialize Bedrock LLM (assumes IAM role has access)
llm = ChatBedrock(
    model_id="anthropic.claude-3-sonnet-20240229-v1:0",
    model_kwargs={"max_tokens": 512, "temperature": 0.7},
)

prompt = ChatPromptTemplate.from_template("Answer this: {question}")

chain = prompt | llm | StrOutputParser()

@app.post("/query")
async def query_llm(prompt_data: PromptCreate):
    question = prompt_data.question
    result = chain.invoke({"question": question})
    return {"response": result}

if __name__ == "__main__":
   import uvicorn
   uvicorn.run(app, host="127.0.0.1", port=8000)
