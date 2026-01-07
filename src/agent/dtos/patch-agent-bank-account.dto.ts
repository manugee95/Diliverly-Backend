import { PartialType } from "@nestjs/mapped-types";
import { CreateAgentBankAccountDto } from "./create-agent-bank-account.dto";

export class PatchAgentBankAccountDto extends PartialType(CreateAgentBankAccountDto) {}