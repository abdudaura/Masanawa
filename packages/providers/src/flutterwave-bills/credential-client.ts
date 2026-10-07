import {
  resolveCredentialSecret,
  type CredentialMaterialSource,
} from "@masanawa/security";
import type {
  CredentialRefId,
  OperationId,
  ProviderId,
  TenantId,
} from "@masanawa/contracts";
import {
  FlutterwaveBillsClient,
  type FlutterwaveBillCategory,
  type FlutterwaveBiller,
  type FlutterwaveBillItem,
  type FlutterwaveBillReceipt,
  type FlutterwaveBillsTransport,
  type FlutterwaveCustomerValidation,
} from "./client.js";
import { FlutterwaveHttpTransport } from "./http-transport.js";

export interface FlutterwaveBillsCredentialScope {
  readonly tenantId: TenantId;
  readonly credentialRefId: CredentialRefId;
  readonly providerId: ProviderId;
  readonly operationId: OperationId;
  readonly slotKey?: string;
}

export class CredentialResolvedFlutterwaveBillsClient {
  readonly #source: CredentialMaterialSource;
  readonly #scope: FlutterwaveBillsCredentialScope;
  readonly #transport: FlutterwaveBillsTransport;

  constructor(input: Readonly<{
    source: CredentialMaterialSource;
    scope: FlutterwaveBillsCredentialScope;
    transport?: FlutterwaveBillsTransport;
  }>) {
    this.#source = input.source;
    this.#scope = input.scope;
    this.#transport = input.transport ?? new FlutterwaveHttpTransport();
  }

  async #withClient<T>(
    operation: (client: FlutterwaveBillsClient) => Promise<T>,
  ): Promise<T> {
    const secret = await resolveCredentialSecret(this.#source, {
      tenantId: this.#scope.tenantId,
      credentialRefId: this.#scope.credentialRefId,
      providerId: this.#scope.providerId,
      operationId: this.#scope.operationId,
      slotKey: this.#scope.slotKey ?? "secret-key",
    });
    return secret.use((value) =>
      operation(
        new FlutterwaveBillsClient({
          secretKey: value,
          transport: this.#transport,
          country: "NG",
        }),
      ),
    );
  }

  listCategories(signal?: AbortSignal): Promise<readonly FlutterwaveBillCategory[]> {
    return this.#withClient((client) => client.listCategories(signal));
  }

  listBillers(
    categoryCode: string,
    signal?: AbortSignal,
  ): Promise<readonly FlutterwaveBiller[]> {
    return this.#withClient((client) => client.listBillers(categoryCode, signal));
  }

  listItems(
    billerCode: string,
    signal?: AbortSignal,
  ): Promise<readonly FlutterwaveBillItem[]> {
    return this.#withClient((client) => client.listItems(billerCode, signal));
  }

  validateCustomer(
    itemCode: string,
    customer: string,
    signal?: AbortSignal,
  ): Promise<FlutterwaveCustomerValidation> {
    return this.#withClient((client) =>
      client.validateCustomer(itemCode, customer, signal),
    );
  }

  createPayment(input: Parameters<FlutterwaveBillsClient["createPayment"]>[0]): Promise<FlutterwaveBillReceipt> {
    return this.#withClient((client) => client.createPayment(input));
  }

  getStatus(
    reference: string,
    signal?: AbortSignal,
  ): Promise<FlutterwaveBillReceipt | null> {
    return this.#withClient((client) => client.getStatus(reference, signal));
  }
}
