import { PartialType } from "@nestjs/mapped-types";
import { CreateBankAccountDto } from "./create-bank-account.dto";

export class PatchBankAccountDto extends PartialType(CreateBankAccountDto) {}