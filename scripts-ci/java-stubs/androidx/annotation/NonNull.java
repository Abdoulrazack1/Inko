package androidx.annotation;
import java.lang.annotation.*;
@Retention(RetentionPolicy.CLASS) @Target({ElementType.PARAMETER, ElementType.METHOD, ElementType.FIELD})
public @interface NonNull {}
