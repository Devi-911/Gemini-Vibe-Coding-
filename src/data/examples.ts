import { ModelFile } from "../types";

export const SAMPLE_MODELS: ModelFile[] = [
  {
    id: "loan-approval-bpmn",
    name: "Standard Loan Approval Flow (BPMN)",
    type: "bpmn",
    createdAt: "2026-05-20T00:00:00.000Z",
    isPreloaded: true,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  id="Definitions_LoanApproval"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_LoanApproval" name="Standard Loan Approval" isExecutable="true">
    <bpmn:startEvent id="StartEvent_LoanRequest" name="Loan Application Received">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_LoanRequest" targetRef="Task_AssessRisk" />
    
    <bpmn:userTask id="Task_AssessRisk" name="Assess Credit &amp; Risk Profile">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_AssessRisk" targetRef="Gateway_ScoreCheck" />
    
    <bpmn:exclusiveGateway id="Gateway_ScoreCheck" name="Credit Score Tier?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Approved</bpmn:outgoing>
      <bpmn:outgoing>Flow_ManualCheck</bpmn:outgoing>
      <bpmn:outgoing>Flow_Rejected</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:sequenceFlow id="Flow_Approved" name="Score &gt;= 700" sourceRef="Gateway_ScoreCheck" targetRef="Task_AutoApprove">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${creditScore &gt;= 700}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:sequenceFlow id="Flow_ManualCheck" name="Score between 550 and 699" sourceRef="Gateway_ScoreCheck" targetRef="Task_ManualReview">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${creditScore &gt;= 550 &amp;&amp; creditScore &lt; 700}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:sequenceFlow id="Flow_Rejected" name="Score &lt; 550" sourceRef="Gateway_ScoreCheck" targetRef="Task_NotifyRejection">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${creditScore &lt; 550}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:serviceTask id="Task_AutoApprove" name="Prepare and auto-issue funds">
      <bpmn:incoming>Flow_Approved</bpmn:incoming>
      <bpmn:outgoing>Flow_SuccessAuto</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <bpmn:userTask id="Task_ManualReview" name="Manual Underwriting Review">
      <bpmn:incoming>Flow_ManualCheck</bpmn:incoming>
      <bpmn:outgoing>Flow_ManualDecision</bpmn:outgoing>
    </bpmn:userTask>
    
    <bpmn:exclusiveGateway id="Gateway_ManualApproval" name="Approved by Underwriter?">
      <bpmn:incoming>Flow_ManualDecision</bpmn:incoming>
      <bpmn:outgoing>Flow_ManualYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_ManualNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:sequenceFlow id="Flow_ManualDecision" sourceRef="Task_ManualReview" targetRef="Gateway_ManualApproval" />
    
    <bpmn:sequenceFlow id="Flow_ManualYes" name="Yes" sourceRef="Gateway_ManualApproval" targetRef="Task_IssueFundsManual">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${underwriterApproval == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:sequenceFlow id="Flow_ManualNo" name="No" sourceRef="Gateway_ManualApproval" targetRef="Task_NotifyRejection">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${underwriterApproval == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    
    <bpmn:serviceTask id="Task_IssueFundsManual" name="Issue loan payout manually">
      <bpmn:incoming>Flow_ManualYes</bpmn:incoming>
      <bpmn:outgoing>Flow_SuccessManual</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <bpmn:serviceTask id="Task_NotifyRejection" name="Send Rejection Email">
      <bpmn:incoming>Flow_Rejected</bpmn:incoming>
      <bpmn:incoming>Flow_ManualNo</bpmn:incoming>
      <bpmn:outgoing>Flow_EndRejected</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <bpmn:endEvent id="EndEvent_Approved" name="Loan Approved and Disbursed">
      <bpmn:incoming>Flow_SuccessAuto</bpmn:incoming>
      <bpmn:incoming>Flow_SuccessManual</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:endEvent id="EndEvent_Rejected" name="Loan Application Rejected">
      <bpmn:incoming>Flow_EndRejected</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:sequenceFlow id="Flow_SuccessAuto" sourceRef="Task_AutoApprove" targetRef="EndEvent_Approved" />
    <bpmn:sequenceFlow id="Flow_SuccessManual" sourceRef="Task_IssueFundsManual" targetRef="EndEvent_Approved" />
    <bpmn:sequenceFlow id="Flow_EndRejected" sourceRef="Task_NotifyRejection" targetRef="EndEvent_Rejected" />
  </bpmn:process>
</bpmn:definitions>`
  },
  {
    id: "ecommerce-fulfillment-bpmn-errors",
    name: "Fulfillment Flow with Deliberate Deadlocks (BPMN)",
    type: "bpmn",
    createdAt: "2026-05-20T00:00:00.000Z",
    isPreloaded: true,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  id="Definitions_FulfillmentErrors"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_OrderFulfillment" name="Fulfillment with Logic Warnings" isExecutable="true">
    <bpmn:startEvent id="StartEvent_OrderReceived" name="Order Placed">
      <bpmn:outgoing>Flow_To_Authorize</bpmn:outgoing>
    </bpmn:startEvent>
    
    <bpmn:sequenceFlow id="Flow_To_Authorize" sourceRef="StartEvent_OrderReceived" targetRef="Task_AuthorizePayment" />
    
    <bpmn:serviceTask id="Task_AuthorizePayment" name="Authorize Credit Card Card">
      <!-- Missing outgoing flow name - Potential flow gap -->
      <bpmn:incoming>Flow_To_Authorize</bpmn:incoming>
      <bpmn:outgoing>Flow_To_Gateway</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <bpmn:sequenceFlow id="Flow_To_Gateway" sourceRef="Task_AuthorizePayment" targetRef="Gateway_Split_Fulfillment" />
    
    <!-- Parallel Gateway without matching join - CRITICAL DEADLOCK POTENTIAL -->
    <bpmn:parallelGateway id="Gateway_Split_Fulfillment" name="Pack and Invoice Parallel Split">
      <bpmn:incoming>Flow_To_Gateway</bpmn:incoming>
      <bpmn:outgoing>Flow_Branch_A</bpmn:outgoing>
      <bpmn:outgoing>Flow_Branch_B</bpmn:outgoing>
    </bpmn:parallelGateway>
    
    <bpmn:sequenceFlow id="Flow_Branch_A" sourceRef="Gateway_Split_Fulfillment" targetRef="Task_PackGoods" />
    <bpmn:sequenceFlow id="Flow_Branch_B" sourceRef="Gateway_Split_Fulfillment" targetRef="Task_IssueInvoice" />
    
    <bpmn:userTask id="Task_PackGoods" name="Pack Physical Goods">
      <bpmn:incoming>Flow_Branch_A</bpmn:incoming>
      <bpmn:outgoing>Flow_Pack_End</bpmn:outgoing>
    </bpmn:userTask>
    
    <bpmn:serviceTask id="Task_IssueInvoice" name="Generate Custom Billing Statement">
      <bpmn:incoming>Flow_Branch_B</bpmn:incoming>
      <bpmn:outgoing>Flow_Invoice_End</bpmn:outgoing>
    </bpmn:serviceTask>
    
    <!-- WRONG JOIN: This should be a parallel join gateway, but is modeled as an Exclusive Gateway. Token race condition! -->
    <bpmn:exclusiveGateway id="Gateway_Join_Fulfillment" name="Race Gateway">
      <bpmn:incoming>Flow_Pack_End</bpmn:incoming>
      <bpmn:incoming>Flow_Invoice_End</bpmn:incoming>
      <bpmn:outgoing>Flow_To_Ship</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:sequenceFlow id="Flow_Pack_End" sourceRef="Task_PackGoods" targetRef="Gateway_Join_Fulfillment" />
    <bpmn:sequenceFlow id="Flow_Invoice_End" sourceRef="Task_IssueInvoice" targetRef="Gateway_Join_Fulfillment" />
    
    <bpmn:userTask id="Task_Shipment" name="Ship Parcel Details">
      <bpmn:incoming>Flow_To_Ship</bpmn:incoming>
      <bpmn:outgoing>Flow_To_End</bpmn:outgoing>
    </bpmn:userTask>
    
    <!-- Orphaned and unreachable gateway block representing manual error pathway -->
    <bpmn:userTask id="Task_UnreachableAdmin" name="Dead Administration Loop Task">
      <bpmn:incoming>Flow_InfiniteLoopLink</bpmn:incoming>
      <bpmn:outgoing>Flow_InfiniteLoopBack</bpmn:outgoing>
    </bpmn:userTask>
    
    <bpmn:sequenceFlow id="Flow_InfiniteLoopLink" sourceRef="Task_UnreachableAdmin" targetRef="Task_UnreachableAdmin" />
    
    <bpmn:sequenceFlow id="Flow_To_Ship" sourceRef="Gateway_Join_Fulfillment" targetRef="Task_Shipment" />
    <bpmn:sequenceFlow id="Flow_To_End" sourceRef="Task_Shipment" targetRef="EndEvent_Fulfilled" />
    
    <bpmn:endEvent id="EndEvent_Fulfilled" name="Order Dispatched Handled">
      <bpmn:incoming>Flow_To_End</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>`
  },
  {
    id: "credit-scoring-dmn",
    name: "Customer Loan Underwriting Check (DMN)",
    type: "dmn",
    createdAt: "2026-05-20T00:00:00.000Z",
    isPreloaded: true,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="Definitions_CreditRiskAssessment"
             name="Credit Risk Assessment Model"
             namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Decision_UnderwriteScore" name="Credit Risk Underwriting Assessment">
    <decisionTable id="DecisionTable_Underwrite" hitPolicy="UNIQUE">
      <input id="Input_Age" label="Client Age">
        <inputExpression id="InputExpr_Age" typeRef="integer">
          <text>age</text>
        </inputExpression>
      </input>
      <input id="Input_MonthlyIncome" label="Monthly Household Income">
        <inputExpression id="InputExpr_MonthlyIncome" typeRef="number">
          <text>monthlyIncome</text>
        </inputExpression>
      </input>
      <input id="Input_HasPriorBankruptcy" label="Prior Bankruptcy Record">
        <inputExpression id="InputExpr_Bankruptcy" typeRef="boolean">
          <text>hasBankruptcy</text>
        </inputExpression>
      </input>
      
      <output id="Output_RiskLevel" label="Computed Assessment Risk Code" name="riskLevel" typeRef="string" />
      <output id="Output_InterestPremium" label="Interest Interest Premium Rate (%)" name="interestPremium" typeRef="number" />
      
      <rule id="DmnRule_1">
        <inputEntry id="RuleInput_Age_1">
          <text>&lt; 18</text>
        </inputEntry>
        <inputEntry id="RuleInput_Income_1">
          <text>-</text>
        </inputEntry>
        <inputEntry id="RuleInput_Bankruptcy_1">
          <text>-</text>
        </inputEntry>
        <outputEntry id="RuleOutput_Risk_1">
          <text>"Declined_Underage"</text>
        </outputEntry>
        <outputEntry id="RuleOutput_Premium_1">
          <text>99.99</text>
        </outputEntry>
      </rule>
      
      <rule id="DmnRule_2">
        <inputEntry id="RuleInput_Age_2">
          <text>&gt;= 18</text>
        </inputEntry>
        <inputEntry id="RuleInput_Income_2">
          <text>-</text>
        </inputEntry>
        <inputEntry id="RuleInput_Bankruptcy_2">
          <text>true</text>
        </inputEntry>
        <outputEntry id="RuleOutput_Risk_2">
          <text>"Critical"</text>
        </outputEntry>
        <outputEntry id="RuleOutput_Premium_2">
          <text>12.50</text>
        </outputEntry>
      </rule>
      
      <rule id="DmnRule_3">
        <inputEntry id="RuleInput_Age_3">
          <text>&gt;= 18</text>
        </inputEntry>
        <inputEntry id="RuleInput_Income_3">
          <text>&lt; 2500</text>
        </inputEntry>
        <inputEntry id="RuleInput_Bankruptcy_3">
          <text>false</text>
        </inputEntry>
        <outputEntry id="RuleOutput_Risk_3">
          <text>"High"</text>
        </outputEntry>
        <outputEntry id="RuleOutput_Premium_3">
          <text>6.25</text>
        </outputEntry>
      </rule>
      
      <rule id="DmnRule_4">
        <inputEntry id="RuleInput_Age_4">
          <text>&gt;= 18</text>
        </inputEntry>
        <inputEntry id="RuleInput_Income_4">
          <text>[2500..6000]</text>
        </inputEntry>
        <inputEntry id="RuleInput_Bankruptcy_4">
          <text>false</text>
        </inputEntry>
        <outputEntry id="RuleOutput_Risk_4">
          <text>"Medium"</text>
        </outputEntry>
        <outputEntry id="RuleOutput_Premium_4">
          <text>2.50</text>
        </outputEntry>
      </rule>
      
      <rule id="DmnRule_5">
        <inputEntry id="RuleInput_Age_5">
          <text>&gt;= 18</text>
        </inputEntry>
        <inputEntry id="RuleInput_Income_5">
          <text>&gt; 6000</text>
        </inputEntry>
        <inputEntry id="RuleInput_Bankruptcy_5">
          <text>false</text>
        </inputEntry>
        <outputEntry id="RuleOutput_Risk_5">
          <text>"Low"</text>
        </outputEntry>
        <outputEntry id="RuleOutput_Premium_5">
          <text>0.00</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`
  }
];
