package androidx.work;
public class Constraints {
    public static class Builder {
        public Builder setRequiredNetworkType(NetworkType t) { return this; }
        public Constraints build() { return new Constraints(); }
    }
}
