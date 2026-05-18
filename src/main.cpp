#include <Arduino.h>

#define LED_PIN 2

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);

  Serial.println("========================================");
  Serial.println("   Motiva Perseverance v0.1 — ESP32    ");
  Serial.println("   Hello World! Sistema iniciado.      ");
  Serial.println("========================================");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("[OK] LED ON  — rover ativo");
  delay(1000);

  digitalWrite(LED_PIN, LOW);
  Serial.println("[OK] LED OFF — aguardando...");
  delay(1000);
}
