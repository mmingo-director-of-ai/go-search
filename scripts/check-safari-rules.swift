import Foundation
import WebKit
let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let rules = try JSONSerialization.jsonObject(with: data) as! [[String: Any]]
let blockers: [[String: Any]] = rules.map { rule in
  let condition = rule["condition"] as! [String: Any]
  return ["trigger": ["url-filter": condition["regexFilter"]!, "url-filter-is-case-sensitive": true], "action": ["type": "block"]]
}
let json = String(data: try JSONSerialization.data(withJSONObject: blockers), encoding: .utf8)!
var done = false
var failed = false
WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "go-search-validation", encodedContentRuleList: json) { list, error in
  if let error { print("FAIL: \(error)"); failed = true }
  else { print("PASS: WebKit compiled \(rules.count) Safari routing patterns") }
  WKContentRuleListStore.default().removeContentRuleList(forIdentifier: "go-search-validation") { _ in done = true }
}
while !done { RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1)) }
exit(failed ? 1 : 0)
